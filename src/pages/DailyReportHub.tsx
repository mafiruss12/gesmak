import { useMemo, type ReactNode } from 'react';
import { useSearchParams, Navigate, Link } from 'react-router-dom';
import {
  ShoppingCart, History, Moon, FileText,
} from 'lucide-react';
import Caisse from '@/pages/Caisse';
import LiveDaySales from '@/pages/LiveDaySales';
import Documents from '@/pages/Documents';

type TabId = 'encaisser' | 'historique' | 'terminer' | 'docs';

const TABS: { id: TabId; label: string; icon: ReactNode; short: string }[] = [
  { id: 'encaisser', label: 'Encaisser', short: 'Encaisser', icon: <ShoppingCart size={16} /> },
  { id: 'historique', label: 'Historique', short: 'Historique', icon: <History size={16} /> },
  { id: 'terminer', label: 'Terminer la journée', short: 'Clôturer', icon: <Moon size={16} /> },
  { id: 'docs', label: 'Documents', short: 'Docs', icon: <FileText size={16} /> },
];

function parseTab(raw: string | null): TabId {
  if (
    raw === 'historique' ||
    raw === 'ventes' ||
    raw === 'live' ||
    raw === 'live-sales' ||
    raw === 'history'
  ) {
    return 'historique';
  }
  if (raw === 'terminer' || raw === 'close' || raw === 'cloture' || raw === 'z' || raw === 'point') {
    return 'terminer';
  }
  if (raw === 'docs' || raw === 'documents' || raw === 'devis' || raw === 'facture') return 'docs';
  // caisse / pos / défaut → encaisser
  return 'encaisser';
}

/**
 * Vente journalière unique :
 * Encaisser (panier, stock décrémenté à la validation) · Historique (traces) · Terminer la journée
 */
export default function DailyReportHub() {
  const [params, setParams] = useSearchParams();
  const tab = useMemo(() => parseTab(params.get('tab')), [params]);

  function setTab(id: TabId) {
    const next = new URLSearchParams(params);
    if (id === 'encaisser') next.delete('tab');
    else next.set('tab', id);
    setParams(next, { replace: true });
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold font-display text-stone-100 flex items-center gap-2">
          <ShoppingCart className="text-amber-400" size={26} />
          Vente journalière
        </h1>
        <p className="text-sm text-stone-400 mt-1">
          Panier → valider après l&apos;argent · le stock baisse tout de suite · les traces restent dans{' '}
          <button
            type="button"
            className="text-amber-400 font-semibold underline-offset-2 hover:underline"
            onClick={() => setTab('historique')}
          >
            Historique
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
        {tab === 'encaisser' && <Caisse embedded />}
        {tab === 'historique' && <LiveDaySales embedded mode="history" />}
        {tab === 'terminer' && <LiveDaySales embedded mode="close" />}
        {tab === 'docs' && (
          <div className="space-y-3">
            <p className="text-sm text-stone-400">
              Devis / factures (optionnel). Le quotidien = onglet{' '}
              <button type="button" className="text-amber-400 underline" onClick={() => setTab('encaisser')}>
                Encaisser
              </button>
              .
            </p>
            <Documents embedded />
          </div>
        )}
      </div>
    </div>
  );
}

export function RedirectToReportTab({ tab }: { tab: string }) {
  const map: Record<string, string> = {
    point: 'terminer',
    live: 'historique',
    ventes: 'historique',
    caisse: 'encaisser',
    pos: 'encaisser',
    cloture: 'terminer',
    z: 'terminer',
    docs: 'docs',
    historique: 'historique',
    encaisser: 'encaisser',
    terminer: 'terminer',
  };
  const t = map[tab] || 'encaisser';
  return <Navigate to={t === 'encaisser' ? '/daily-report' : `/daily-report?tab=${t}`} replace />;
}
