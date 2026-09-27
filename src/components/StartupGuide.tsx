import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle2, Circle, ChevronRight, Package, ShoppingCart,
  ClipboardCheck, Wallet, Users, Settings, Sparkles, X,
} from 'lucide-react';
import {
  normalizeBusinessType,
  BUSINESS_LABELS,
  BUSINESS_THEMES,
  type BusinessType,
} from '@/lib/businessTypes';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type Step = {
  id: string;
  title: string;
  description: string;
  to: string;
  icon: React.ReactNode;
  check: (ctx: CheckCtx) => boolean;
};

type CheckCtx = {
  hasProducts: boolean;
  hasSale: boolean;
  hasSession: boolean;
  hasEmployee: boolean;
  hasEstablishment: boolean;
};

function stepsFor(type: BusinessType): Step[] {
  if (type === 'complexe' && false) {
    return [
      {
        id: 'est',
        title: 'Configurer l’établissement',
        description: 'Nom, adresse et coordonnées de votre entreprise BTP',
        to: '/settings',
        icon: <Settings size={18} />,
        check: (c) => c.hasEstablishment,
      },
      {
        id: 'materials',
        title: 'Charger les matériaux',
        description: 'Catalogue devis (ciment, fer, sable…)',
        to: '/btp/materials',
        icon: <Package size={18} />,
        check: (c) => c.hasProducts,
      },
      {
        id: 'client',
        title: 'Ajouter un client',
        description: 'Fiche client pour devis et factures',
        to: '/btp/clients',
        icon: <Users size={18} />,
        check: () => false,
      },
      {
        id: 'devis',
        title: 'Créer un premier devis',
        description: 'Mode tableau ou saisie par champs',
        to: '/btp/documents',
        icon: <ClipboardCheck size={18} />,
        check: () => false,
      },
    ];
  }
  if (type === 'location_event') {
    return [
      {
        id: 'est',
        title: 'Configurer l’établissement',
        description: 'Nom et infos de votre activité location',
        to: '/settings',
        icon: <Settings size={18} />,
        check: (c) => c.hasEstablishment,
      },
      {
        id: 'equip',
        title: 'Enregistrer le matériel',
        description: 'Chaises, tables, bâches, sono…',
        to: '/rent/equipment',
        icon: <Package size={18} />,
        check: (c) => c.hasProducts,
      },
      {
        id: 'pack',
        title: 'Créer un pack',
        description: 'Kits mariage / cérémonie',
        to: '/rent/packs',
        icon: <Sparkles size={18} />,
        check: () => false,
      },
      {
        id: 'order',
        title: 'Première commande',
        description: 'Réserver du matériel pour un client',
        to: '/rent/orders',
        icon: <ShoppingCart size={18} />,
        check: (c) => c.hasSale,
      },
    ];
  }
  // maquis + commerce
  return [
    {
      id: 'est',
      title: 'Configurer l’établissement',
      description: 'Nom, type et coordonnées',
      to: '/settings',
      icon: <Settings size={18} />,
      check: (c) => c.hasEstablishment,
    },
    {
      id: 'stock',
      title: 'Vérifier le stock de départ',
      description: type === 'maquis'
        ? 'Catalogue boissons déjà préchargé (stock à 0) — saisissez vos quantités'
        : 'Ajoutez ou importez vos produits',
      to: '/inventory',
      icon: <Package size={18} />,
      check: (c) => c.hasProducts,
    },
    {
      id: 'sale',
      title: 'Enregistrer une première vente',
      description: 'Via la caisse rapide',
      to: '/pos',
      icon: <ShoppingCart size={18} />,
      check: (c) => c.hasSale,
    },
    {
      id: 'report',
      title: 'Faire le rapport du jour',
      description: 'Point de fin de service et envoi au propriétaire',
      to: '/daily-report',
      icon: <ClipboardCheck size={18} />,
      check: () => false,
    },
    {
      id: 'team',
      title: 'Ajouter un collaborateur',
      description: 'Gérant, caissier ou employé',
      to: '/mes-employes',
      icon: <Users size={18} />,
      check: (c) => c.hasEmployee,
    },
  ];
}

const STORAGE_KEY = 'mm_startup_guide_dismissed';

export default function StartupGuide({ compact = false }: { compact?: boolean }) {
  const { member, activeEstablishment } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const bizType = normalizeBusinessType(activeEstablishment?.type);
  const theme = BUSINESS_THEMES[bizType];
  const steps = useMemo(() => stepsFor(bizType), [bizType]);

  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [ctx, setCtx] = useState<CheckCtx>({
    hasProducts: false,
    hasSale: false,
    hasSession: false,
    hasEmployee: false,
    hasEstablishment: !!activeEstablishment?.name,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!estId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const [prod, sales, sess, emps] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('establishment_id', estId),
        supabase.from('sales').select('id', { count: 'exact', head: true }).eq('establishment_id', estId).limit(1),
        supabase.from('cash_sessions').select('id', { count: 'exact', head: true }).eq('establishment_id', estId).limit(1),
        supabase.from('members').select('id', { count: 'exact', head: true }).eq('establishment_id', estId),
      ]);
      if (cancelled) return;
      setCtx({
        hasProducts: (prod.count ?? 0) > 0,
        hasSale: (sales.count ?? 0) > 0,
        hasSession: (sess.count ?? 0) > 0,
        hasEmployee: (emps.count ?? 0) > 1,
        hasEstablishment: !!activeEstablishment?.name,
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [estId, activeEstablishment?.name]);

  const doneCount = steps.filter((s) => s.check(ctx)).length;
  const allDone = doneCount === steps.length;

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch { /* */ }
    setDismissed(true);
  }

  if (dismissed && compact) return null;
  if (allDone && compact) return null;

  return (
    <div
      className={`rounded-2xl border border-amber-500/30 bg-stone-900/70 startup-guide-card ${compact ? 'mb-6 p-4' : 'p-5'}`}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <Link to="/guide" className="block min-w-0 flex-1 hover:opacity-90 cursor-pointer">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-accent, #E89B2D)' }}>
            Guide de démarrage · {BUSINESS_LABELS[bizType]}
          </p>
          <h2 className="text-lg font-bold text-stone-100 mt-0.5">
            {allDone ? 'Configuration terminée 🎉' : 'Mettez votre activité en route'}
          </h2>
          <p className="text-sm text-stone-400 mt-1">
            {loading ? 'Vérification…' : `${doneCount}/${steps.length} étapes complétées — toucher une étape`}
          </p>
        </Link>
        {compact && (
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-800 hover:text-stone-300"
            title="Masquer"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-stone-800 mb-4 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${steps.length ? (doneCount / steps.length) * 100 : 0}%`,
            background: 'var(--color-accent, #E89B2D)',
          }}
        />
      </div>

      <ul className="space-y-2">
        {steps.map((step, i) => {
          const done = step.check(ctx);
          return (
            <li key={step.id}>
              <Link
                to={step.to}
                role="button"
                className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition-all cursor-pointer active:scale-[0.99] hover:scale-[1.01] relative z-10 ${
                  done
                    ? 'border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/15'
                    : 'border-amber-500/25 bg-stone-950/40 hover:border-amber-500/50 hover:bg-amber-500/10'
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    done ? 'bg-emerald-500/25 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                  }`}
                >
                  {done ? <CheckCircle2 size={18} /> : step.icon}
                </span>
                <div className="flex-1 min-w-0 text-left">
                  <p className={`text-sm font-semibold ${done ? 'text-emerald-300' : 'text-stone-100'}`}>
                    {i + 1}. {step.title}
                  </p>
                  <p className="text-xs text-stone-400 truncate">{step.description}</p>
                  <p className="text-[11px] text-amber-400/90 mt-0.5">
                    {done ? 'Terminé — ouvrir' : 'Appuyer pour ouvrir →'}
                  </p>
                </div>
                <ChevronRight size={18} className={`shrink-0 ${done ? 'text-emerald-400' : 'text-amber-400'}`} />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
