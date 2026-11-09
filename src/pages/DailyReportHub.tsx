import { useMemo, type ReactNode } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import {
  ShoppingCart, History, Moon, BarChart3,
} from 'lucide-react';
import Caisse from '@/pages/Caisse';
import LiveDaySales from '@/pages/LiveDaySales';
import VenteRapports from '@/pages/VenteRapports';

type TabId = 'encaisser' | 'historique' | 'terminer' | 'rapport';

const TABS: { id: TabId; label: string; icon: ReactNode; short: string }[] = [
  { id: 'encaisser', label: 'Encaisser', short: 'Encaisser', icon: <ShoppingCart size={16} /> },
  { id: 'historique', label: 'Historique', short: 'Historique', icon: <History size={16} /> },
  { id: 'terminer', label: 'Terminer la journée', short: 'Clôturer', icon: <Moon size={16} /> },
  { id: 'rapport', label: 'Rapport', short: 'Rapport', icon: <BarChart3 size={16} /> },
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
  if (raw === 'rapport' || raw === 'docs' || raw === 'documents' || raw === 'reports' || raw === 'pdf') {
    return 'rapport';
  }
  return 'encaisser';
}

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
          Encaisser · Historique détaillé · Clôturer · Rapports (jour / semaine / mois / année / PDF)
        </p>
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <div className="flex gap-1.5 min-w-max pb-1">
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
        {tab === 'rapport' && <VenteRapports />}
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
    docs: 'rapport',
    rapport: 'rapport',
    historique: 'historique',
    encaisser: 'encaisser',
    terminer: 'terminer',
  };
  const t = map[tab] || 'encaisser';
  return <Navigate to={t === 'encaisser' ? '/daily-report' : `/daily-report?tab=${t}`} replace />;
}
