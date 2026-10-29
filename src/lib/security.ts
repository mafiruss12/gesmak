/**
 * Sécurité GESMAK
 * 1) Session : stockage Supabase auth token (clé stable projet)
 * 2) Rôles admin : toujours via table members (DB), jamais trust localStorage seul
 * 3) Rate-limit login : client + serveur (/api/security/login-throttle)
 * 4) Mots de passe robustes + HIBP
 * 5) Messages d'erreur non révélateurs
 */

const LOGIN_ATTEMPTS_KEY = 'mm_login_attempts';
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

interface AttemptState {
  count: number;
  lockedUntil: number;
}

function readAttempts(): AttemptState {
  try {
    const raw = localStorage.getItem(LOGIN_ATTEMPTS_KEY);
    if (!raw) return { count: 0, lockedUntil: 0 };
    return JSON.parse(raw) as AttemptState;
  } catch {
    return { count: 0, lockedUntil: 0 };
  }
}

function writeAttempts(s: AttemptState) {
  try {
    localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(s));
  } catch {
    /* */
  }
}

export function getLoginLockRemaining(): number {
  const s = readAttempts();
  return Math.max(0, s.lockedUntil - Date.now());
}

export function isLoginLocked(): boolean {
  return getLoginLockRemaining() > 0;
}

export function registerLoginFailure(): void {
  const s = readAttempts();
  const count = s.count + 1;
  const lockedUntil = count >= MAX_ATTEMPTS ? Date.now() + LOCK_MS : 0;
  writeAttempts({ count, lockedUntil });
}

export function registerLoginSuccess(): void {
  writeAttempts({ count: 0, lockedUntil: 0 });
}

/** Appel serveur rate-limit (P0). Ne bloque pas si l’API est down. */
export async function serverLoginThrottle(
  identifier: string,
  action: 'check' | 'fail' | 'success',
): Promise<{ locked: boolean; remainingMs: number; fails?: number }> {
  try {
    const ctrl = new AbortController();
    const t = window.setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch('/api/security/login-throttle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: identifier.trim().slice(0, 120), action }),
      signal: ctrl.signal,
    });
    window.clearTimeout(t);
    if (!res.ok) return { locked: isLoginLocked(), remainingMs: getLoginLockRemaining() };
    const j = (await res.json()) as { locked?: boolean; remainingMs?: number; fails?: number };
    if (j.locked && (j.remainingMs || 0) > 0) {
      writeAttempts({
        count: MAX_ATTEMPTS,
        lockedUntil: Date.now() + Number(j.remainingMs || LOCK_MS),
      });
    }
    if (action === 'success') registerLoginSuccess();
    return {
      locked: Boolean(j.locked),
      remainingMs: Number(j.remainingMs || 0),
      fails: j.fails,
    };
  } catch {
    return { locked: isLoginLocked(), remainingMs: getLoginLockRemaining() };
  }
}

export function isStrongEnoughPassword(password: string): { ok: boolean; reason?: string } {
  if (!password || password.length < 8) {
    return { ok: false, reason: 'Mot de passe : 8 caractères minimum.' };
  }
  if (password.length > 128) {
    return { ok: false, reason: 'Mot de passe trop long.' };
  }
  return { ok: true };
}

export function isSafeLogin(login: string): boolean {
  const s = login.trim();
  if (!s || s.length > 120) return false;
  if (/\s{2,}/.test(s)) return false;
  return true;
}

export async function logSecurityEvent(
  type: string,
  meta: Record<string, unknown> = {},
): Promise<void> {
  try {
    // Best-effort : ne jamais bloquer le flux login
    void type;
    void meta;
  } catch {
    /* */
  }
}

export function makeSignupCaptcha(): { a: number; b: number; expected: number } {
  const a = 2 + Math.floor(Math.random() * 8);
  const b = 1 + Math.floor(Math.random() * 9);
  return { a, b, expected: a + b };
}

export function checkSignupCaptcha(answer: string, expected: number): boolean {
  const n = Number(String(answer).trim());
  return Number.isFinite(n) && n === expected;
}

export async function isPasswordBreached(password: string): Promise<boolean> {
  try {
    const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(password));
    const hash = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = ctrl ? window.setTimeout(() => ctrl.abort(), 2500) : 0;
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal: ctrl?.signal,
    });
    if (t) window.clearTimeout(t);
    if (!res.ok) return false;
    const text = await res.text();
    return text.split('\n').some((line) => line.split(':')[0]?.trim() === suffix);
  } catch {
    return false;
  }
}

/** Rôles privilégiés : à valider uniquement via row members Supabase */
export function isPrivilegedRole(role: string | null | undefined): boolean {
  return role === 'super_admin' || role === 'admin';
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function isSafeImageUrl(url: string): boolean {
  if (!url || !url.trim()) return true;
  try {
    const u = new URL(url.trim());
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export function safeErrorMessage(err: unknown, fallback = 'Une erreur est survenue'): string {
  if (!err) return fallback;
  const msg = typeof err === 'string' ? err : (err as { message?: string })?.message || fallback;
  if (/password|invalid|credentials|email/i.test(msg)) {
    return 'Identifiant ou mot de passe incorrect.';
  }
  if (/network|fetch|Failed to fetch/i.test(msg)) return 'Réseau indisponible. Mode hors ligne activé.';
  if (/JWT|token|session/i.test(msg)) return 'Session expirée. Reconnectez-vous.';
  return fallback;
}
