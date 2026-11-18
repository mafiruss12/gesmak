import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  ShoppingCart,
  Package,
  ClipboardCheck,
  Truck,
  Calculator,
  UtensilsCrossed,
  LayoutGrid,
  Beer,
  FileText,
  Users,
  Wallet,
  ScanLine,
  PlusCircle,
  BarChart3,
  Boxes,
  BedDouble,
  CalendarCheck,
  Sparkles,
  Receipt,
  MapPin,
} from 'lucide-react';
import {
  normalizeBusinessType,
  type BusinessType,
  BUSINESS_THEMES,
} from '@/lib/businessTypes';

type Action = {
  to: string;
  label: string;
  sub?: string;
  icon: ReactNode;
  color: string;
  bg: string;
};

function actionsFor(type: BusinessType): Action[] {
  switch (type) {
    case 'maquis':
      return [
        { to: '/live-sales', label: 'Ventes journée', sub: 'Client par client', icon: <ShoppingCart size={22} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.18)' },
        { to: '/inventory', label: 'Stock boissons', sub: 'Casiers & grillades', icon: <Beer size={22} />, color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
        { to: '/orders', label: 'Commandes bar', sub: 'Tables & service', icon: <Receipt size={22} />, color: '#ec4899', bg: 'rgba(236,72,153,0.15)' },
        { to: '/daily-report', label: 'Point du soir', sub: 'Clôture classique', icon: <ClipboardCheck size={22} />, color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
        { to: '/mes-employes', label: 'Employés', sub: 'Accès équipe', icon: <Users size={22} />, color: '#a855f7', bg: 'rgba(168,85,247,0.15)' },
        { to: '/menu-qr', label: 'Menu QR Code', sub: 'Carte digitale', icon: <LayoutGrid size={22} />, color: '#14b8a6', bg: 'rgba(20,184,166,0.15)' },
      ];
    case 'restaurant':
      return [
        { to: '/tables', label: 'Plan de salle', sub: 'Tables & serveurs', icon: <LayoutGrid size={22} />, color: '#ef4444', bg: 'rgba(239,68,68,0.18)' },
        { to: '/menu-carte', label: 'Carte & Plats', sub: 'Menu restaurant', icon: <UtensilsCrossed size={22} />, color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
        { to: '/kitchen', label: 'Cuisine (KDS)', sub: 'File des plats', icon: <UtensilsCrossed size={22} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
        { to: '/reservations', label: 'Réservations', sub: 'Clients & couverts', icon: <CalendarCheck size={22} />, color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' },
        { to: '/orders', label: 'Commandes', sub: 'Salle & à emporter', icon: <Receipt size={22} />, color: '#0ea5e9', bg: 'rgba(14,165,233,0.15)' },
        { to: '/pos', label: 'Caisse resto', sub: 'Encaissement', icon: <ShoppingCart size={22} />, color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
        { to: '/inventory', label: 'Stock cuisine', sub: 'Ingrédients', icon: <Package size={22} />, color: '#14b8a6', bg: 'rgba(20,184,166,0.15)' },
        { to: '/cloture', label: 'Clôture Z', sub: 'Fin de service', icon: <ClipboardCheck size={22} />, color: '#ec4899', bg: 'rgba(236,72,153,0.15)' },
      ];
    case 'depot':
      return [
        { to: '/depot/clients', label: 'Clients dépôt', sub: 'Revendeurs & bars', icon: <Users size={22} />, color: '#0ea5e9', bg: 'rgba(14,165,233,0.18)' },
        { to: '/depot/deliveries', label: 'Livraisons', sub: 'Bons de sortie', icon: <Truck size={22} />, color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
        { to: '/depot/tours', label: 'Tournées', sub: 'Camions & livreurs', icon: <MapPin size={22} />, color: '#14b8a6', bg: 'rgba(20,184,166,0.15)' },
        { to: '/depot/creances', label: 'Créances', sub: 'Crédits clients', icon: <Wallet size={22} />, color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
        { to: '/depot/consignes', label: 'Consignes', sub: 'Casiers & bouteilles', icon: <Beer size={22} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
        { to: '/inventory', label: 'Stock gros', sub: 'Cartons & palettes', icon: <Boxes size={22} />, color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
        { to: '/depot/tracking', label: 'Suivi GPS', sub: 'Position livreurs', icon: <Truck size={22} />, color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' },
        { to: '/daily-report', label: 'Rapport dépôt', sub: 'Synthèse du jour', icon: <BarChart3 size={22} />, color: '#6366f1', bg: 'rgba(99,102,241,0.15)' },
      ];
    case 'location_event':
      return [
        { to: '/rent/orders', label: 'Nouvelle commande', sub: 'Location', icon: <ShoppingCart size={22} />, color: '#6366f1', bg: 'rgba(99,102,241,0.18)' },
        { to: '/rent/equipment', label: 'Matériel', sub: 'Stock location', icon: <Boxes size={22} />, color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
        { to: '/rent/calendar', label: 'Planning', sub: 'Disponibilités', icon: <LayoutGrid size={22} />, color: '#14b8a6', bg: 'rgba(20,184,166,0.15)' },
        { to: '/rent/movements', label: 'Mouvements', sub: 'Sorties / retours', icon: <Truck size={22} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
        { to: '/rent/payments', label: 'Paiements', sub: 'Encaissements', icon: <Wallet size={22} />, color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
        { to: '/rent/clients', label: 'Clients', sub: 'Fiches clients', icon: <Users size={22} />, color: '#ec4899', bg: 'rgba(236,72,153,0.15)' },
        { to: '/rent/packs', label: 'Packs', sub: 'Kits événement', icon: <Package size={22} />, color: '#a855f7', bg: 'rgba(168,85,247,0.15)' },
        { to: '/daily-report', label: 'Rapport du jour', sub: 'Synthèse', icon: <FileText size={22} />, color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
      ];
    case 'complexe':
      return [
        { to: '/hotel', label: 'Réception hôtel', sub: 'Vue complexe', icon: <BedDouble size={22} />, color: '#6d28d9', bg: 'rgba(109,40,217,0.18)' },
        { to: '/hotel/rooms', label: 'Chambres', sub: 'Statuts & clés', icon: <BedDouble size={22} />, color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' },
        { to: '/hotel/reservations', label: 'Réservations', sub: 'Check-in / out', icon: <CalendarCheck size={22} />, color: '#0ea5e9', bg: 'rgba(14,165,233,0.15)' },
        { to: '/hotel/housekeeping', label: 'Housekeeping', sub: 'Ménage chambres', icon: <Sparkles size={22} />, color: '#14b8a6', bg: 'rgba(20,184,166,0.15)' },
        { to: '/orders', label: 'Commandes bar/resto', sub: 'Pôles F&B', icon: <Receipt size={22} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
        { to: '/pos', label: 'Caisse', sub: 'Encaissement', icon: <ShoppingCart size={22} />, color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
        { to: '/expenses', label: 'Dépenses', sub: 'Charges complexe', icon: <Wallet size={22} />, color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
        { to: '/mes-employes', label: 'Équipe', sub: 'Staff multi-pôles', icon: <Users size={22} />, color: '#ec4899', bg: 'rgba(236,72,153,0.15)' },
      ];
    default:
      return [
        { to: '/pos', label: 'Nouvelle vente', sub: 'Caisse', icon: <ShoppingCart size={22} />, color: '#06b6d4', bg: 'rgba(6,182,212,0.18)' },
        { to: '/point-manuel', label: 'Point manuel', sub: 'Comptage stock', icon: <ClipboardCheck size={22} />, color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
        { to: '/inventory', label: 'État du stock', sub: 'Inventaire', icon: <Package size={22} />, color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
        { to: '/inventory/scan', label: 'Scan inventaire', sub: 'Photo / code', icon: <ScanLine size={22} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
        { to: '/purchases', label: 'Approvisionnement', sub: 'Achats', icon: <Truck size={22} />, color: '#a855f7', bg: 'rgba(168,85,247,0.15)' },
        { to: '/cloture', label: 'Clôture Z', sub: 'Fermer la journée', icon: <Wallet size={22} />, color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
        { to: '/customers', label: 'Clients', sub: 'Fiches', icon: <Users size={22} />, color: '#ec4899', bg: 'rgba(236,72,153,0.15)' },
        { to: '/daily-report', label: 'Rapport du jour', sub: 'Synthèse', icon: <Calculator size={22} />, color: '#6366f1', bg: 'rgba(99,102,241,0.15)' },
      ];
  }
}

export default function QuickActions({ businessType }: { businessType?: string | null }) {
  const type = normalizeBusinessType(businessType);
  const theme = BUSINESS_THEMES[type];
  const actions = actionsFor(type);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">
          Actions rapides
        </h2>
        <div className="flex items-center gap-3">
          <Link
            to="/pouvoirs"
            className="text-xs font-semibold hover:underline"
            style={{ color: theme.primary }}
          >
            Rôles &amp; Pouvoirs
          </Link>
          <Link
            to="/guide"
            className="text-xs font-medium hover:underline"
            style={{ color: theme.primary }}
          >
            Guide de démarrage →
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {actions.map((a) => (
          <Link
            key={a.to + a.label}
            to={a.to}
            className="group relative flex flex-col items-start gap-2 rounded-2xl border border-stone-800/80 p-3.5 transition-all hover:scale-[1.02] active:scale-[0.98] hover:border-stone-700"
            style={{ background: a.bg }}
          >
            <span
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm"
              style={{ background: a.color }}
            >
              {a.icon}
            </span>
            <div>
              <p className="text-sm font-semibold text-stone-100 leading-tight">{a.label}</p>
              {a.sub && <p className="text-[11px] text-stone-400 mt-0.5 leading-tight">{a.sub}</p>}
            </div>
            <PlusCircle
              size={14}
              className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-40 transition-opacity text-stone-300"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
