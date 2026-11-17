import { useEffect, useState, type ReactNode } from 'react';
import { needsMfaStepUp, hasVerifiedTotpFactor, verifyTotpCode } from '@/lib/supabaseMfa';
import { useAuth } from '@/lib/auth';

/**
 * Bloque admin/super_admin en AAL1 si un facteur TOTP vérifié existe.
 * Source de vérité : session Supabase MFA (pas members.mfa_enabled).
 */
export default function MfaGate({ children }: { children: ReactNode }) {
  const { member, loading } = useAuth();
  const role = String(member?.role || '');
  const isAdmin = role === 'admin' || role === 'super_admin';
  const [checking, setChecking] = useState(isAdmin);
  const [needCode, setNeedCode] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !isAdmin) {
      setChecking(false);
      setNeedCode(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setChecking(true);
      try {
        const need = await needsMfaStepUp();
        if (cancelled) return;
        if (need) {
          const f = await hasVerifiedTotpFactor();
          setFactorId(f.factorId);
          setNeedCode(true);
        } else {
          setNeedCode(false);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, isAdmin, member?.user_id]);

  async function submit() {
    if (!factorId) {
      setError('Facteur MFA introuvable');
      return;
    }
    setBusy(true);
    setError(null);
    const res = await verifyTotpCode(factorId, code);
    setBusy(false);
    if (!res.ok) {
      setError(res.error || 'Code incorrect');
      return;
    }
    setNeedCode(false);
    setCode('');
  }

  if (!isAdmin) return <>{children}</>;
  if (checking) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-stone-500 text-sm">
        Vérification sécurité…
      </div>
    );
  }
  if (needCode) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-4">
        <div className="max-w-sm w-full rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-6 space-y-4 shadow-lg">
          <h1 className="text-lg font-bold text-stone-900 dark:text-stone-100">
            Double authentification
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Entrez le code à 6 chiffres de votre application d&apos;authentification pour accéder
            à l&apos;administration.
          </p>
          <input
            className="input-field text-center tracking-[0.3em] text-lg"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            autoFocus
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="button"
            className="btn-primary w-full"
            disabled={busy || code.length !== 6}
            onClick={() => void submit()}
          >
            {busy ? 'Vérification…' : 'Valider'}
          </button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
