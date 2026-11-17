/**
 * MFA native Supabase Auth (TOTP) — AAL1 / AAL2
 * Ne stocke PAS le secret côté public.members.
 */
import { supabase } from '@/lib/supabase';

async function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}


export type AalLevel = 'aal1' | 'aal2';

export async function getAssuranceLevel(): Promise<{
  currentLevel: AalLevel | null;
  nextLevel: AalLevel | null;
  error: string | null;
}> {
  try {
    const result = await withTimeout(
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      4000,
      { data: null, error: { message: 'AAL timeout' } } as any,
    );
    const { data, error } = result;
    if (error) return { currentLevel: null, nextLevel: null, error: error.message };
    return {
      currentLevel: (data?.currentLevel as AalLevel) || null,
      nextLevel: (data?.nextLevel as AalLevel) || null,
      error: null,
    };
  } catch (e: unknown) {
    return {
      currentLevel: null,
      nextLevel: null,
      error: e instanceof Error ? e.message : 'AAL indisponible',
    };
  }
}

/** True si un facteur TOTP vérifié existe (MFA activée côté Auth). */
export async function hasVerifiedTotpFactor(): Promise<{
  has: boolean;
  factorId: string | null;
  error: string | null;
}> {
  try {
    const result = await withTimeout(
      supabase.auth.mfa.listFactors(),
      4000,
      { data: null, error: { message: 'listFactors timeout' } } as any,
    );
    const { data, error } = result;
    if (error) return { has: false, factorId: null, error: error.message };
    const totp = data?.totp || [];
    const verified = totp.find((f) => f.status === 'verified');
    return {
      has: Boolean(verified),
      factorId: verified?.id || null,
      error: null,
    };
  } catch (e: unknown) {
    return {
      has: false,
      factorId: null,
      error: e instanceof Error ? e.message : 'listFactors failed',
    };
  }
}

/** Session admin avec MFA enrôlée mais pas encore AAL2. */
export async function needsMfaStepUp(): Promise<boolean> {
  const aal = await getAssuranceLevel();
  if (aal.error) return false;
  if (aal.currentLevel === 'aal2') return false;
  if (aal.nextLevel === 'aal2') return true;
  const f = await hasVerifiedTotpFactor();
  return f.has && aal.currentLevel === 'aal1';
}

export async function enrollTotp(friendlyName = 'GESMAK Admin'): Promise<{
  factorId: string;
  qrCode: string;
  secret: string;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName,
    });
    if (error || !data) {
      return {
        factorId: '',
        qrCode: '',
        secret: '',
        error: error?.message || 'Échec enrollment MFA',
      };
    }
    return {
      factorId: data.id,
      qrCode: data.totp?.qr_code || '',
      secret: data.totp?.secret || '',
      error: null,
    };
  } catch (e: unknown) {
    return {
      factorId: '',
      qrCode: '',
      secret: '',
      error: e instanceof Error ? e.message : 'enroll failed',
    };
  }
}

/** Challenge + verify code 6 chiffres → session AAL2 */
export async function verifyTotpCode(
  factorId: string,
  code: string,
): Promise<{ ok: boolean; error: string | null }> {
  const cleaned = code.replace(/\D/g, '').slice(0, 6);
  if (cleaned.length !== 6) {
    return { ok: false, error: 'Saisissez le code à 6 chiffres' };
  }
  try {
    const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({
      factorId,
    });
    if (cErr || !challenge?.id) {
      return { ok: false, error: cErr?.message || 'Impossible de créer le challenge MFA' };
    }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: cleaned,
    });
    if (vErr) {
      return { ok: false, error: vErr.message || 'Code incorrect' };
    }
    return { ok: true, error: null };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Vérification MFA échouée',
    };
  }
}

/** Vérifie un facteur en cours d'enrollment (status unverified). */
export async function verifyEnrollment(
  factorId: string,
  code: string,
): Promise<{ ok: boolean; error: string | null }> {
  return verifyTotpCode(factorId, code);
}

export async function unenrollAllTotp(): Promise<{ ok: boolean; error: string | null }> {
  try {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) return { ok: false, error: error.message };
    const all = [...(data?.totp || []), ...(data?.phone || [])];
    for (const f of all) {
      const { error: uErr } = await supabase.auth.mfa.unenroll({ factorId: f.id });
      if (uErr) return { ok: false, error: uErr.message };
    }
    return { ok: true, error: null };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'unenroll failed',
    };
  }
}

/** Marqueur applicatif optionnel (pas la source de vérité). */
export async function syncMemberMfaFlag(
  userId: string,
  enabled: boolean,
): Promise<void> {
  try {
    await supabase
      .from('members')
      .update({
        mfa_enabled: enabled,
        // ne plus stocker de secret applicatif
        mfa_secret: null,
      })
      .eq('user_id', userId);
  } catch {
    /* ignore */
  }
}
