import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronRight, Clock, RefreshCw, UtensilsCrossed, Wine } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { formatFCFA, formatTime } from '@/lib/format';

type OrderRow = {
  id: string;
  status: string;
  total: number;
  created_at: string;
  customer_name?: string | null;
  table_number?: string | null;
  source?: string | null;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Nouvelle', cls: 'bg-red-500 text-white animate-pulse' },
  preparing: { label: 'En prep.', cls: 'bg-amber-500 text-stone-950' },
  ready: { label: 'Prête', cls: 'bg-emerald-500 text-white' },
  served: { label: 'Servie', cls: 'bg-stone-600 text-stone-200' },
  cancelled: { label: 'Annulée', cls: 'bg-stone-700 text-stone-400' },
};

export default function DashboardOrdersPanel() {
  const { member, activeEstablishment } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!estId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    // silent = realtime/refresh : ne pas afficher "Chargement…"
    if (!silent) {
      setLoading(true);
    }
    try {
      const { data } = await supabase
        .from('orders')
        .select('id, status, total, created_at, customer_name, table_number, source')
        .eq('establishment_id', estId)
        .in('status', ['pending', 'preparing', 'ready'])
        .order('created_at', { ascending: false })
        .limit(12);
      setOrders((data as OrderRow[]) || []);
    } finally {
      setLoading(false);
    }
  }, [estId]);

  useEffect(() => {
    void load();
    if (!estId) return;
    const ch = supabase
      .channel(`dash-orders-${estId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `establishment_id=eq.${estId}` },
        () => void load(true),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [estId, load]);

  const pending = orders.filter((o) => o.status === 'pending').length;

  return (
    <section className="rounded-2xl border border-stone-700/80 bg-gradient-to-br from-stone-900 via-stone-900 to-stone-950 overflow-hidden shadow-lg">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-stone-700/80 bg-stone-900/80">
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/20 text-red-400">
            <Bell size={18} />
            {pending > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[1.15rem] h-5 px-1 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
                {pending}
              </span>
            )}
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-stone-100 truncate">Commandes en cours</h2>
            <p className="text-[11px] text-stone-400">
              {pending > 0 ? `${pending} à prendre en charge` : 'File d’attente à jour'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1 rounded-lg border border-stone-600 bg-stone-800 px-2.5 py-1.5 text-[11px] font-semibold text-stone-200 hover:bg-stone-700"
            title="Actualiser"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualiser
          </button>
          <Link
            to="/orders"
            className="inline-flex items-center gap-0.5 rounded-lg bg-amber-500 px-2.5 py-1.5 text-[11px] font-bold text-stone-950 hover:bg-amber-400"
          >
            Ouvrir
            <ChevronRight size={14} />
          </Link>
        </div>
      </div>

      <div className="p-3 space-y-2 max-h-[320px] overflow-y-auto">
        {loading && orders.length === 0 && (
          <p className="text-center text-xs text-stone-500 py-6">Chargement…</p>
        )}
        {!loading && orders.length === 0 && (
          <div className="text-center py-8 text-stone-500 text-sm">
            <UtensilsCrossed className="mx-auto mb-2 opacity-40" size={28} />
            Aucune commande en cours
          </div>
        )}
        {orders.map((o) => {
          const st = STATUS[o.status] || STATUS.pending;
          const isNew = o.status === 'pending';
          return (
            <Link
              key={o.id}
              to={`/orders?focus=${o.id}`}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                isNew
                  ? 'border-red-500/50 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
                  : 'border-stone-700/80 bg-stone-800/50 hover:border-stone-600'
              }`}
            >
              <div
                className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isNew ? 'bg-red-500/20 text-red-300' : 'bg-stone-700 text-stone-300'
                }`}
              >
                {o.source === 'qr' || o.table_number ? <Wine size={18} /> : <UtensilsCrossed size={18} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${st.cls}`}>
                    {st.label}
                  </span>
                  {o.table_number && (
                    <span className="text-[11px] font-semibold text-amber-300">Table {o.table_number}</span>
                  )}
                </div>
                <p className="text-sm font-medium text-stone-100 truncate mt-0.5">
                  {o.customer_name?.trim() || 'Client'}
                </p>
                <p className="text-[11px] text-stone-500 flex items-center gap-1">
                  <Clock size={12} />
                  {formatTime(o.created_at)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-amber-400">{formatFCFA(Number(o.total) || 0)}</p>
                <ChevronRight size={16} className="ml-auto text-stone-500" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
