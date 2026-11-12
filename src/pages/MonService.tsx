import { useCallback, useEffect, useState } from 'react';
import { Users, CheckCircle2, Clock, ChefHat, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { formatFCFA, formatTime } from '@/lib/format';
import { EmptyState, Badge } from '@/components/ui';
import { ORDER_STATUS_LABELS } from '@/lib/types';

type MyOrder = {
  id: string;
  table_number: string | null;
  table_id: string | null;
  status: string;
  total: number;
  created_at: string;
  items?: { product_name: string; qty: number; unit_price: number }[];
};

type MyTable = {
  id: string;
  number: string;
  status: string;
  seats: number;
  location: string;
};

export default function MonService() {
  const { member, activeEstablishment } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const uid = member?.user_id;
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [tables, setTables] = useState<MyTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!estId || !uid) {
      setLoading(false);
      return;
    }
    const [oRes, tRes] = await Promise.all([
      supabase
        .from('orders')
        .select('id, table_number, table_id, status, total, created_at')
        .eq('establishment_id', estId)
        .eq('server_id', uid)
        .in('status', ['pending', 'preparing', 'ready'])
        .order('created_at', { ascending: true }),
      supabase
        .from('restaurant_tables')
        .select('id, number, status, seats, location')
        .eq('establishment_id', estId)
        .eq('server_id', uid)
        .order('number'),
    ]);
    const ords = (oRes.data || []) as MyOrder[];
    const ids = ords.map((o) => o.id);
    if (ids.length) {
      const { data: items } = await supabase
        .from('order_items')
        .select('order_id, product_name, qty, unit_price')
        .in('order_id', ids);
      const by: Record<string, MyOrder['items']> = {};
      for (const it of items || []) {
        (by[it.order_id] ||= []).push(it as any);
      }
      for (const o of ords) o.items = by[o.id] || [];
    }
    setOrders(ords);
    setTables((tRes.data || []) as MyTable[]);
    setLoading(false);
  }, [estId, uid]);

  useEffect(() => {
    void load();
    if (!estId || !uid) return;
    const ch = supabase
      .channel(`mon-service-${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `establishment_id=eq.${estId}` },
        () => void load(),
      )
      .subscribe();
    const t = setInterval(() => void load(), 15000);
    return () => {
      clearInterval(t);
      void supabase.removeChannel(ch);
    };
  }, [estId, uid, load]);

  async function markServed(o: MyOrder) {
    setBusy(o.id);
    await supabase.from('orders').update({ status: 'served' }).eq('id', o.id);
    await supabase.from('order_items').update({ status: 'served' }).eq('order_id', o.id);
    setBusy(null);
    await load();
  }

  if (loading) {
    return <div className="py-8 text-center text-sm text-stone-500">Préparation…</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-stone-100 flex items-center gap-2">
          <Users className="text-amber-400" /> Mon service
        </h1>
        <p className="text-sm text-stone-400 mt-1">
          Tables et commandes qui vous sont attribuées
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-3">
          <p className="text-[10px] text-stone-500 uppercase">Mes tables</p>
          <p className="text-2xl font-bold text-stone-100">{tables.length}</p>
        </div>
        <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-3">
          <p className="text-[10px] text-stone-500 uppercase">Commandes actives</p>
          <p className="text-2xl font-bold text-amber-300">{orders.length}</p>
        </div>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-stone-300 mb-2">Tables assignées</h2>
        {tables.length === 0 ? (
          <p className="text-sm text-stone-500">Aucune table pour le moment.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {tables.map((t) => (
              <div
                key={t.id}
                className={`rounded-xl border p-3 text-center ${
                  t.status === 'occupied'
                    ? 'border-amber-500/40 bg-amber-500/10'
                    : 'border-stone-800 bg-stone-900/50'
                }`}
              >
                <p className="text-2xl font-bold">{t.number}</p>
                <p className="text-[10px] text-stone-500">{t.location}</p>
                <Badge color={t.status === 'occupied' ? 'warning' : 'success'}>
                  {t.status === 'occupied' ? 'Occupée' : t.status === 'free' ? 'Libre' : t.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-stone-300">Commandes à servir</h2>
        {orders.length === 0 ? (
          <EmptyState
            icon={<ChefHat size={40} />}
            title="Rien en attente"
            message="Quand le gérant vous attribue une table, les commandes apparaissent ici."
          />
        ) : (
          orders.map((o) => (
            <div
              key={o.id}
              className={`rounded-2xl border p-4 ${
                o.status === 'ready'
                  ? 'border-emerald-500/40 bg-emerald-500/10'
                  : 'border-stone-800 bg-stone-900/60'
              }`}
            >
              <div className="flex justify-between gap-2 mb-2">
                <div>
                  <p className="font-bold text-stone-100">Table {o.table_number || '—'}</p>
                  <p className="text-xs text-stone-500">
                    {formatTime(o.created_at)} · {ORDER_STATUS_LABELS[o.status] || o.status}
                  </p>
                </div>
                <Badge color={o.status === 'ready' ? 'success' : 'warning'}>
                  {ORDER_STATUS_LABELS[o.status] || o.status}
                </Badge>
              </div>
              <ul className="text-sm space-y-1 mb-3">
                {(o.items || []).map((it, i) => (
                  <li key={i} className="flex justify-between text-stone-200">
                    <span>
                      {it.product_name} × {it.qty}
                    </span>
                    <span className="text-amber-300/90 font-mono">
                      {formatFCFA(it.qty * Number(it.unit_price))}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between items-center">
                <span className="font-bold text-amber-300">{formatFCFA(Number(o.total) || 0)}</span>
                {o.status === 'ready' && (
                  <button
                    type="button"
                    className="btn-primary text-sm min-h-[40px] px-4 flex items-center gap-1"
                    disabled={busy === o.id}
                    onClick={() => void markServed(o)}
                  >
                    {busy === o.id ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                    Marquer servie
                  </button>
                )}
                {o.status !== 'ready' && (
                  <span className="text-xs text-stone-500 flex items-center gap-1">
                    <Clock size={12} /> En cuisine / bar
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
