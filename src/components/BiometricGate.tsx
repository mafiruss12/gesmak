import { useState } from 'react';
import { Fingerprint, Loader2, Shield } from 'lucide-react';
import {
  needsBiometricGate,
  verifyBiometric,
  isBiometricSupported,
  disableBiometric,
} from '@/lib/biometric';

export default function BiometricGate({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(() => needsBiometricGate());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!locked) return <>{children}</>;

  async function unlock() {
    setBusy(true);
    setError(null);
    const res = await verifyBiometric();
    setBusy(false);
    if (res.ok) {
      setLocked(false);
    } else {
      setError(res.error || 'Échec');
    }
  }

  function skipDisable() {
    if (confirm('Désactiver la biométrie sur cet appareil ?')) {
      disableBiometric();
      setLocked(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-5">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
          <Fingerprint size={32} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-stone-100">Déverrouiller GESMAK</h1>
          <p className="text-sm text-stone-400 mt-2">
            Utilisez votre empreinte, Face ID ou le déverrouillage de l’appareil.
          </p>
        </div>
        {error && (
          <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={busy || !isBiometricSupported()}
          onClick={() => void unlock()}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 text-stone-950 font-semibold py-3 hover:bg-amber-400 disabled:opacity-50"
        >
          {busy ? <Loader2 className="animate-spin" size={18} /> : <Shield size={18} />}
          Déverrouiller
        </button>
        <button
          type="button"
          onClick={skipDisable}
          className="text-xs text-stone-500 hover:text-stone-300 underline"
        >
          Désactiver la biométrie
        </button>
      </div>
    </div>
  );
}
