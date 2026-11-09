import { useMemo, type ReactNode } from 'react';
import { useSearchParams, Navigate, Link } from 'react-router-dom';
import {
  ShoppingCart, History, Moon, FileText,
} from 'lucide-react';
import Caisse from '@/pages/Caisse';
import LiveDaySales from '@/pages/LiveDaySales';
import Documents from '@/pages/Documents';

type TabId = 'caisse' | 'ventes' | 'terminer' | 'docs';

const TABS: { id: TabId; label: string; icon: ReactNode; short: string }[] = [
  { id: 'caisse', label: 'Caisse', short: 'Caisse', icon: <ShoppingCart size={16} /> },
  { id: 'ventes', label: 'Ventes du jour', short: 'Ventes', icon: <History size={16} /> },
  { id: 'terminer', label: 'Terminer la journée', short: 'Clôturer', icon: <Moon size={16} /> },
  { id: 'docs', label: 'Documents', short: 'Docs', icon: <FileText size={16} /> },
];

function parseTab(raw: string | null): TabId {
  if (raw === 'ventes' || raw === 'live' || raw === 'live-sales' || raw === 'historique') return 'ventes';
  if (raw === 'terminer' || raw === 'close' || raw === 'cloture' || raw === 'z' || raw === 'point') return 'terminer';
  if (raw === 'docs' || raw === 'documents' || raw === 'devis' || raw === 'facture') return 'docs';
  return 'caisse';
}

/**
 * Journée unifiée :
 * Caisse (clients sans QR) → historique → Terminer la journée (rapport auto)
 */
export default function DailyReportHub() {
  const [params, setParams] = useSearchParams();
  const tab = useMemo(() => parseTab(params.get('tab')), [params]);

  function setTab(id: TabId) {
    const next = new URLSearchParams(params);
    if (id === 'caisse') next.delete('tab');
    else next.set('tab', id);
    setParams(next, { replace: true });
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold font-display text-stone-100 flex items-center gap-2">
          <ShoppingCart className="text-amber-400" size={26} />
          Caisse & journée
        </h1>
        <p className="text-sm text-stone-400 mt-1">
          Vendez au panier (clients sans QR) · le rapport part automatiquement quand vous{' '}
          <button
            type="button"
            className="text-amber-400 font-semibold underline-offset-2 hover:underline"
            onClick={() => setTab('terminer')}
          >
            Terminez la journée
          </button>
        </p>
      </div>

      <div className="sticky top-0 z-20 -mx-1 px-1 py-1 bg-stone-950/90 backdrop-blur border-b border-stone-800">
        <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                  active
                    ? t.id === 'terminer'
                      ? 'bg-orange-500/25 text-orange-100 border-orange-500/50'
                      : 'bg-amber-500/20 text-amber-100 border-amber-500/40'
                    : 'bg-stone-900 text-stone-400 border-stone-800 hover:text-stone-200'
                }`}
              >
                {t.icon}
                <span className="sm:hidden">{t.short}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-[50vh]">
        {tab === 'caisse' && <Caisse embedded />}
        {tab === 'ventes' && <LiveDaySales embedded mode="history" />}
        {tab === 'terminer' && <LiveDaySales embedded mode="close" />}
        {tab === 'docs' && (
          <div className="space-y-3">
            <p className="text-sm text-stone-400">
              Devis et factures (optionnel). Pour le quotidien maquis, utilisez d&apos;abord la{' '}
              <button type="button" className="text-amber-400 underline" onClick={() => setTab('caisse')}>
                Caisse
              </button>
              .
            </p>
            <Documents embedded />
            <Link to="/documents" className="text-xs text-stone-500 hover:text-amber-400">
              Ouvrir la page Documents complète →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

/** Redirections anciennes URL → onglets du hub */
export function RedirectToReportTab({ tab }: { tab: string }) {
  const map: Record<string, string> = {
    point: 'terminer',
    live: 'ventes',
    caisse: 'caisse',
    pos: 'caisse',
    cloture: 'terminer',
    z: 'terminer',
    docs: 'docs',
  };
  const t = map[tab] || 'caisse';
  return <Navigate to={t === 'caisse' ? '/daily-report' : `/daily-report?tab=${t}`} replace />;
}
