import { useMemo, useState } from 'react';
import { Newspaper, ChevronRight, X } from 'lucide-react';
import {
  normalizeBusinessType,
  type BusinessType,
  BUSINESS_THEMES,
} from '@/lib/businessTypes';

type NewsItem = {
  id: string;
  title: string;
  body: string;
  tag: string;
  date: string;
};

const NEWS_BY_TYPE: Record<BusinessType, NewsItem[]> = {
  maquis: [
    {
      id: 'm1',
      title: 'Prix des bières locales — suivi août 2026',
      body: 'Les casiers Solibra / Brassivoire restent stables. Surveillez les promos dépôt pour le Bock et le Castel 33.',
      tag: 'Marché',
      date: '2026-08-20',
    },
    {
      id: 'm2',
      title: 'Astuce marge : kits happy hour',
      body: 'Proposez un pack 6+1 le soir : le volume monte souvent de 15–25 % sans baisser trop le ticket moyen.',
      tag: 'Conseil',
      date: '2026-08-18',
    },
    {
      id: 'm3',
      title: 'Point manuel en fin de service',
      body: 'Comptez les restants avant de clôturer : moins d’écarts caisse et un rapport du jour plus fiable.',
      tag: 'Gestes',
      date: '2026-08-15',
    },
  ],
  magasin: [
    {
      id: 'g1',
      title: 'Réassort rapide en fin de mois',
      body: 'Priorisez les références sous seuil (filtre « Presque épuisé ») avant le week-end de paie.',
      tag: 'Stock',
      date: '2026-08-19',
    },
    {
      id: 'g2',
      title: 'Marge nette vs CA',
      body: 'Suivez le résultat du mois (CA − dépenses − achats) plutôt que le seul chiffre d’affaires.',
      tag: 'Finance',
      date: '2026-08-12',
    },
  ],
  boutique: [
    {
      id: 'b1',
      title: 'Collections & rotation',
      body: 'Identifiez les articles sans mouvement depuis 30 jours pour une promo ciblée.',
      tag: 'Vente',
      date: '2026-08-17',
    },
  ],
  superette: [
    {
      id: 's1',
      title: 'Rayons frais : seuils bas',
      body: 'Baissez le stock minimum sur le frais pour éviter le gaspillage, augmentez-le sur l’épicerie sèche.',
      tag: 'Rayon',
      date: '2026-08-16',
    },
  ],
  quincaillerie: [
    {
      id: 'q1',
      title: 'Saison pluies — demande matériaux',
      body: 'Ciment, fer et bâches : anticipez les ruptures avec le filtre stock Épuisé.',
      tag: 'BTP',
      date: '2026-08-14',
    },
  ],
  location_event: [
    {
      id: 'l1',
      title: 'Mariages — packing le vendredi',
      body: 'Vérifiez les packs chaises + tables + sono 48 h avant chaque sortie.',
      tag: 'Ops',
      date: '2026-08-21',
    },
  ],
  btp: [
    {
      id: 'bt1',
      title: 'Devis clairs = moins de litiges',
      body: 'Détaillez quantités et prix unitaires ; joignez les conditions de paiement sur chaque facture.',
      tag: 'Devis',
      date: '2026-08-13',
    },
  ],
};

const DISMISS_KEY = 'mm_sector_news_dismissed';

export default function SectorNews({ businessType }: { businessType?: string | null }) {
  const type = normalizeBusinessType(businessType);
  const theme = BUSINESS_THEMES[type];
  const items = useMemo(() => NEWS_BY_TYPE[type] || NEWS_BY_TYPE.maquis, [type]);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === items[0]?.id;
    } catch {
      return false;
    }
  });
  const [openId, setOpenId] = useState<string | null>(null);

  if (dismissed || items.length === 0) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, items[0]?.id || '1');
    } catch { /* */ }
    setDismissed(true);
  }

  return (
    <div className="mb-6 rounded-2xl border border-stone-800 bg-stone-900/60 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-800">
        <div className="flex items-center gap-2">
          <Newspaper size={16} style={{ color: theme.primary }} />
          <h2 className="text-sm font-semibold text-stone-200">Actualités métier</h2>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="p-1 text-stone-500 hover:text-stone-300"
          title="Masquer"
        >
          <X size={14} />
        </button>
      </div>
      <ul className="divide-y divide-stone-800/80">
        {items.slice(0, 3).map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => setOpenId(openId === n.id ? null : n.id)}
              className="w-full text-left px-4 py-3 hover:bg-stone-800/40 transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                    style={{ background: theme.primarySoft, color: theme.primary }}
                  >
                    {n.tag}
                  </span>
                  <p className="text-sm font-medium text-stone-100 mt-1">{n.title}</p>
                  {openId === n.id && (
                    <p className="text-xs text-stone-400 mt-1.5 leading-relaxed">{n.body}</p>
                  )}
                </div>
                <ChevronRight
                  size={16}
                  className={`text-stone-600 shrink-0 mt-1 transition ${openId === n.id ? 'rotate-90' : ''}`}
                />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
