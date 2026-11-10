import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Unlock, Lock, Loader2, Sun, Moon } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  fetchServiceStatus,
  openService,
  isServiceOpenLocal,
  type ServiceSnapshot,
  subscribeServiceDay,
} from '@/lib/serviceDay';

/**
 * Bandeau unique de service — stable (pas de clignotement chargement).
 */
export default function WorkDayBanner({ compact = false }: { compact?: boolean }) {
  const { member, activeEstablishment, user } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const [snap, setSnap] = useState<ServiceSnapshot | null>(() =>
    estId ? { status: isServiceOpenLocal(estId) ? 'open' : 'closed', source: 'local' } : null,
  );
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);

  const canManage = ['super_admin', 'admin', 'owner', 'manager', 'cashier'].includes(
    String(member?.role || ''),
  );

  const load = useCallback(async (isBoot = false) => {
    if (!estId) {
      setBooting(false);
      return;
    }
    try {
      const s = await fetchServiceStatus(estId);
      if (mounted.current) setSnap(s);
    } finally {
      if (mounted.current && isBoot) setBooting(false);
    }
  }, [estId]);

  useEffect(() => {
    mounted.current = true;
    void load(true);
    const unsub = subscribeServiceDay(() => {
      // refresh sans passer par "Chargement…"
      if (!estId) return;
      setSnap({
        status: isServiceOpenLocal(estId) ? 'open' : 'closed',
        source: 'local',
      });
      void load(false);
    });
    return () => {
      mounted.current = false;
      unsub();
    };
  }, [estId, load]);

  async function handleOpen() {
    if (!estId || !canManage || busy) return;
    setBusy(true);
    try {
      const res = await openService({
        estId,
        userId: member?.user_id || user?.id,
        by: member?.full_name || member?.role || 'equipe',
      });
      setSnap(res.snap);
    } finally {
      setBusy(false);
    }
  }

  if (!estId) return null;

  // Premier chargement uniquement, et seulement si pas encore de snap local
  if (booting && !snap) {
    return (
      <div className="mb-3 flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700">
        <Loader2 size={14} className="animate-spin" /> Chargement du service…
      </div>
    );
  }

  const isOpen = snap?.status === 'open';

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
          isOpen
            ? 'border-emerald-500/50 bg-emerald-50 text-emerald-800'
            : 'border-stone-300 bg-stone-100 text-stone-700'
        }`}
      >
        <span className={`h-2 w-2 rounded-full ${isOpen ? 'bg-emerald-500' : 'bg-stone-400'}`} />
        {isOpen ? 'Service ouvert' : 'Service fermé'}
      </div>
    );
  }

  return (
    <div
      className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
        isOpen ? 'border-emerald-500/40 bg-emerald-50' : 'border-orange-400 bg-orange-50'
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${
            isOpen ? 'bg-emerald-500/20 text-emerald-700' : 'bg-orange-500/20 text-orange-800'
          }`}
        >
          {isOpen ? <Sun size={18} /> : <Moon size={18} />}
        </span>
        <div>
          <p className="text-sm font-bold text-stone-900">
            {isOpen ? 'Service ouvert' : 'Service fermé'}
          </p>
          <p className="text-xs text-stone-700">
            {isOpen && snap?.opened_at
              ? `Ouvert à ${new Date(snap.opened_at).toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })} — ventes et QR actifs`
              : 'Ouvrez la journée pour activer stock, ventes et commandes QR'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!isOpen && canManage && (
          <button
            type="button"
            onClick={() => void handleOpen()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-3 py-2 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />}
            Ouvrir la journée
          </button>
        )}
        {isOpen && (
          <Link
            to="/daily-report?tab=terminer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-400 bg-white px-3 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-50"
          >
            <Lock size={14} /> Clôturer la journée
          </Link>
        )}
      </div>
    </div>
  );
}
