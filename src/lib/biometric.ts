/**
 * Authentification biométrique via WebAuthn (empreinte / Face ID / Windows Hello).
 * Stockage local du credential id + flag d'activation.
 */

const ENABLED_KEY = 'mm_biometric_enabled';
const CRED_KEY = 'mm_biometric_cred_id';
const UNLOCK_KEY = 'mm_biometric_unlocked_at';
/** Session unlock validity (ms) — 12h */
const UNLOCK_TTL = 12 * 60 * 60 * 1000;

function bufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBuffer(s: string): ArrayBuffer {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer;
}

export function isBiometricSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.PublicKeyCredential &&
    typeof navigator.credentials?.create === 'function'
  );
}

export function isBiometricEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === '1' && !!localStorage.getItem(CRED_KEY);
  } catch {
    return false;
  }
}

export function isBiometricUnlocked(): boolean {
  try {
    const at = Number(localStorage.getItem(UNLOCK_KEY) || 0);
    return at > 0 && Date.now() - at < UNLOCK_TTL;
  } catch {
    return false;
  }
}

export function markBiometricUnlocked(): void {
  try {
    localStorage.setItem(UNLOCK_KEY, String(Date.now()));
  } catch { /* */ }
}

export function clearBiometricUnlock(): void {
  try {
    localStorage.removeItem(UNLOCK_KEY);
  } catch { /* */ }
}

export function disableBiometric(): void {
  try {
    localStorage.removeItem(ENABLED_KEY);
    localStorage.removeItem(CRED_KEY);
    localStorage.removeItem(UNLOCK_KEY);
  } catch { /* */ }
}

/** Enregistre une empreinte / Face ID liée à cet appareil */
export async function registerBiometric(userId: string, displayName: string): Promise<{ ok: boolean; error?: string }> {
  if (!isBiometricSupported()) {
    return { ok: false, error: 'Biométrie non supportée sur cet appareil / navigateur.' };
  }
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userIdBytes = new TextEncoder().encode(userId.slice(0, 64));
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'GESMAK', id: window.location.hostname },
        user: {
          id: userIdBytes,
          name: displayName || userId,
          displayName: displayName || 'Utilisateur',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null;

    if (!cred) return { ok: false, error: 'Enregistrement annulé.' };

    const id = bufferToBase64Url(cred.rawId);
    localStorage.setItem(CRED_KEY, id);
    localStorage.setItem(ENABLED_KEY, '1');
    markBiometricUnlocked();
    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Échec enregistrement biométrique';
    return { ok: false, error: msg };
  }
}

/** Vérifie l'identité via biométrie locale */
export async function verifyBiometric(): Promise<{ ok: boolean; error?: string }> {
  if (!isBiometricEnabled()) {
    return { ok: false, error: 'Biométrie non activée.' };
  }
  if (!isBiometricSupported()) {
    return { ok: false, error: 'Biométrie non supportée.' };
  }
  try {
    const credId = localStorage.getItem(CRED_KEY);
    if (!credId) return { ok: false, error: 'Aucun identifiant biométrique.' };

    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: 'required',
        allowCredentials: [
          {
            type: 'public-key',
            id: base64UrlToBuffer(credId),
            transports: ['internal'],
          },
        ],
      },
    });

    if (!assertion) return { ok: false, error: 'Vérification annulée.' };
    markBiometricUnlocked();
    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Échec vérification biométrique';
    return { ok: false, error: msg };
  }
}

/** Faut-il demander le déverrouillage biométrique ? */
export function needsBiometricGate(): boolean {
  return isBiometricEnabled() && !isBiometricUnlocked();
}
