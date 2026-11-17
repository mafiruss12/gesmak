import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Package, Truck, Wallet, Calendar, AlertTriangle, ClipboardList, ArrowRight, Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { formatFCFA, todayISO } from '@/lib/format';
import { StatCard, EmptyState } from '@/components/ui';
import { BUSINESS_THEMES } from '@/lib/businessTypes';
import type { RentalOrder, RentalEquipment } from '@/lib/rentalTypes';
import { orderBalance } from '@/lib/rentalTypes';

export default function RentDashboard() {
  const { member, activeEstablishment } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const theme = BUSINESS_THEMES.location_event;
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    openOrders: 0,
    todayOrders: 0,
    outQty: 0,
    monthRevenue: 0,
    unpaid: 0,
    returnAlerts: 0,
  });
  const [lists, setLists] = useState<{
    pending: RentalOrder[];
    out: RentalOrder[];
    done: RentalOrder[];
  }>({ pending: [], out: [], done: [] });

  useEffect(() => {
    (async () => {
      if (!estId) {
        setLoading(false);
        return;
      }
      const est = estId;
      const today = todayISO().slice(0, 10);
      const monthStart = today.slice(0, 8) + '01';

      const [ordersRes, eqRes] = await Promise.all([
        supabase.from('rental_orders').select('*').eq('establishment_id', est),
        supabase.from('rental_equipment').select('qty_out').eq('establishment_id', est),
      ]);
      const orders = (ordersRes.data ?? []) as RentalOrder[];
      const equipment = (eqRes.data ?? []) as Pick<RentalEquipment, 'qty_out'>[];

      const openOrders = orders.filter((o) => ['confirmed', 'out', 'draft'].includes(o.status)).length;
      const todayOrders = orders.filter((o) => o.event_date === today).length;
      const outQty = equipment.reduce((s, e) => s + Number(e.qty_out), 0);
      const monthRevenue = orders
        .filter((o) => o.created_at >= monthStart)
        .reduce((s, o) => s + Number(o.paid_amount), 0);
      const unpaid = orders.reduce((s, o) => s + orderBalance(o), 0);
      const returnAlerts = orders.filter(
        (o) => o.status === 'out' && o.return_date && o.return_date <= today
      ).length;

      setStats({ openOrders, todayOrders, outQty, monthRevenue, unpaid, returnAlerts });
      setLists({
        pending: orders.filter((o) => ['draft', 'confirmed'].includes(o.status)).slice(0, 8),
        out: orders.filter((o) => o.status === 'out').slice(0, 8),
        done: orders.filter((o) => o.status === 'returned').slice(0, 8),
      });
      setLoading(false);
    })();
  }, [estId]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary-500" size={28} />
      </div>
    );
  }

  if (!estId) {
    return (
      <EmptyState
        icon={<Package size={48} />}
        title="Location événementielle"
        message="Créez ou sélectionnez un établissement de type location_event."
      />
    );
  }

  const shortcuts = [
    { to: '/rent/orders', label: 'Commandes', icon: ClipboardList },
    { to: '/rent/equipment', label: 'Matériel', icon: Package },
    { to: '/rent/movements', label: 'Sorties', icon: Truck },
    { to: '/rent/payments', label: 'Paiements', icon: Wallet },
    { to: '/rent/calendar', label: 'Calendrier', icon: Calendar },
    { to: '/rent/packs', label: 'Packs', icon: Package },
  ];

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: theme.primary }}>
        Location événementielle
      </p>
      <h1 className="text-2xl font-bold font-display text-stone-100 mb-6">
        {activeEstablishment?.name || 'Tableau de bord'}
      </h1>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <StatCard title="Commandes en cours" value={String(stats.openOrders)} icon={<ClipboardList size={20} />} />
        <StatCard title="Événements du jour" value={String(stats.todayOrders)} icon={<Calendar size={20} />} />
        <StatCard title="Matériel dehors" value={String(stats.outQty)} icon={<Truck size={20} />} />
        <StatCard title="Encaissé (mois)" value={formatFCFA(stats.monthRevenue)} icon={<Wallet size={20} />} />
        <StatCard title="Impayés" value={formatFCFA(stats.unpaid)} icon={<AlertTriangle size={20} />} />
        <StatCard title="Retours à faire" value={String(stats.returnAlerts)} icon={<AlertTriangle size={20} />} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {shortcuts.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.to} to={s.to} className="card flex items-center gap-3 hover:border-stone-600">
              <div className="p-2 rounded-xl" style={{ background: theme.primarySoft, color: theme.primary }}>
                <Icon size={18} />
              </div>
              <span className="text-sm font-medium text-stone-200">{s.label}</span>
              <ArrowRight size={14} className="ml-auto text-stone-600" />
            </Link>
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-stone-100">Commandes par statut</h2>
        <Link to="/rent/orders" className="text-sm text-primary-400">Nouvelle commande →</Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="card">
          <p className="text-xs uppercase text-amber-400 mb-2">À livrer / confirmées</p>
          {lists.pending.length === 0 ? (
            <p className="text-sm text-stone-500">Aucune</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {lists.pending.map((o) => (
                <li key={o.id} className="flex justify-between gap-2">
                  <span className="text-stone-300 truncate">{o.client_name || 'Client'}</span>
                  <span className="text-stone-500 shrink-0">{o.event_date || '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <p className="text-xs uppercase text-primary-400 mb-2">En cours (dehors)</p>
          {lists.out.length === 0 ? (
            <p className="text-sm text-stone-500">Aucune</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {lists.out.map((o) => (
                <li key={o.id} className="flex justify-between gap-2">
                  <span className="text-stone-300 truncate">{o.client_name || 'Client'}</span>
                  <span className="text-stone-500 shrink-0">retour {o.return_date || '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <p className="text-xs uppercase text-success-400 mb-2">Terminées</p>
          {lists.done.length === 0 ? (
            <p className="text-sm text-stone-500">Aucune</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {lists.done.map((o) => (
                <li key={o.id} className="flex justify-between gap-2">
                  <span className="text-stone-300 truncate">{o.client_name || 'Client'}</span>
                  <span className="text-stone-500 shrink-0">{o.event_date || '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
