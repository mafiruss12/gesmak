import { useState } from 'react';
import { ShieldCheck, Loader2, Lock } from 'lucide-react';
import { Modal } from '@/components/ui';
import { poleLabel, verifyManagerPin } from '@/lib/poles';

interface ManagerPinModalProps {
  open: boolean;
  onClose: () => void;
  establishmentId: string;
  poleCode?: string | null;
  action: string;
  title?: string;
  description: string;
  onApproved: (approval: { approved_by: string; approved_by_name: string }) => void;
}

export default function ManagerPinModal({
  open,
  onClose,
  establishmentId,
  poleCode,
  action,
  title = 'Validation Manager requise',
  description,
  onApproved,
}: ManagerPinModalProps) {
  const [pin, setPin] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pin.trim().length < 4) {
      setError('Entrez le code PIN Manager (minimum 4 chiffres).');
      return;
    }
    setBusy(true);
    setError(null);
    const res = await verifyManagerPin({
      establishmentId,
      poleCode,
      pin,
      action,
      reason: reason.trim() || description,
    });
    setBusy(false);
    if (!res.ok || !res.approved_by) {
      setError(res.error || 'Code PIN refusé pour ce pôle.');
      return;
    }
    const approvedBy = res.approved_by;
    const approvedName = res.approved_by_name || 'Manager';
    setPin('');
    setReason('');
    onApproved({ approved_by: approvedBy, approved_by_name: approvedName });
  }

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2.5">
          <Lock className="text-amber-400 shrink-0 mt-0.5" size={18} />
          <div className="text-xs text-stone-200 space-y-1">
            <p className="font-semibold text-amber-200">{description}</p>
            <p className="text-stone-400">
              Pôle concerné : <strong className="text-stone-200">{poleLabel(poleCode)}</strong>. Cette validation est tracée dans le journal d&apos;audit du propriétaire.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        )}

        <div>
          <label className="label">Code PIN du Manager (ou Propriétaire)</label>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={8}
            className="input-field font-mono text-center text-lg tracking-[0.35em]"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="••••"
            autoFocus
          />
        </div>

        <div>
          <label className="label">Motif terrain (optionnel)</label>
          <input
            type="text"
            className="input-field text-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: geste commercial, erreur de saisie…"
          />
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary flex-1">
            Annuler
          </button>
          <button
            type="submit"
            disabled={busy || pin.length < 4}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
            Valider
          </button>
        </div>
      </form>
    </Modal>
  );
}
