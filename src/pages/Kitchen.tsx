import { usePlanAccess } from '@/lib/usePlanAccess';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  UtensilsCrossed, CheckCircle2, Clock, ChefHat, Bell, Wallet, Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Order, OrderItem } from '@/lib/types';
import { ORDER_STATUS_LABELS } from '@/lib/types';
import { formatFCFA, formatTime } from '@/lib/format';
import { EmptyState, Badge } from '@/components/ui';
import { closeTableOrders, closeOrderLinesPartial, type ClosePay } from '@/lib/tableClose';
import {
  loadServerCandidates,
  suggestServers,
  assignServerToOrder,
  autoAssignOrder,
  type ServerCandidate,
} from '@/lib/serverDispatch';
import {
  requestOrderAlertPermissions,
  playOrderAlertSound,
  showOrderBrowserNotification,
  orderSoundEnabled,
} from '@/lib/orderAlerts';

interface OrderWithItems extends Order {
  items?: OrderItem[];
  payment_method?: string | null;
  stock_deducted?: boolean;
}

const ORDER_COLS =
  'id, establishment_id, table_id, table_number, status, order_type, total, notes, created_at, source, payment_method, stock_deducted, server_id, server_name, customer_name';
const ITEM_COLS = 'id, order_id, product_id, product_name, qty, unit_price, status';

export default function Kitchen() {
  const { allow, plan } = usePlanAccess();
  if (!allow('kitchen')) {
    return (
      <div className="card p-6 space-y-2 max-w-lg">
        <h1 className="text-lg font-semibold">Cuisine / file d’attente</h1>
        <p className="text-sm text-stone-400">Fonction Pro. Plan actuel : {plan.label}.</p>
      </div>
    );
  }

  const { member, activeEstablishment } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const prevPending = useRef(0);
  const [closeFor, setCloseFor] = useState<OrderWithItems | null>(null);
  const [pay, setPay] = useState<ClosePay>('cash');
  const [splitMode, setSplitMode] = useState(false);
  const [splitIds, setSplitIds] = useState<string[]>([]);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [alertArmed, setAlertArmed] = useState(false);
  const [flash, setFlash] = useState(false);
  const [assignOrder, setAssignOrder] = useState<OrderWithItems | null>(null);
  const [candidates, setCandidates] = useState<ServerCandidate[]>([]);
  const [assignBusy, setAssignBusy] = useState(false);

  const load = useCallback(async () => {
    if (!estId) {
      setLoading(false);
      return;
    }
    const { data: ordData } = await supabase
      .from('orders')
      .select(ORDER_COLS)
      .eq('establishment_id', estId)
      .in('status', ['pending', 'preparing', 'ready'])
      .order('created_at', { ascending: true });

    if (!ordData) {
      setLoading(false);
      return;
    }

    const ids = (ordData as Order[]).map((o) => o.id);
    const itemsByOrder: Record<string, OrderItem[]> = {};
    if (ids.length) {
      const { data: allItems } = await supabase
        .from('order_items')
        .select(ITEM_COLS)
        .in('order_id', ids);
      for (const it of (allItems as OrderItem[]) || []) {
        (itemsByOrder[it.order_id] ||= []).push(it);
      }
    }
    const ordersWithItems = (ordData as OrderWithItems[]).map((o) => ({
      ...o,
      items: itemsByOrder[o.id] || [],
    }));
    setOrders(ordersWithItems);

    const pend = ordersWithItems.filter((o) => o.status === 'pending').length;
    if (pend > prevPending.current && (prevPending.current > 0 || alertArmed)) {
      playOrderAlertSound();
      showOrderBrowserNotification(
        'Nouvelle commande',
        `${pend} commande(s) en attente — Cuisine / Bar`,
      );
      setFlash(true);
      setTimeout(() => setFlash(false), 4000);
      try {
        document.title = `(${pend}) Cuisine / Bar`;
      } catch {
        /* */
      }
    }
    prevPending.current = pend;
    setLoading(false);
  }, [estId]);

  useEffect(() => {
    void load();
    if (!estId) return;

    const channel = supabase
      .channel(`kitchen-orders-${estId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `establishment_id=eq.${estId}`,
        },
        () => {
          void load();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => {
          void load();
        },
      )
      .subscribe();

    // secours si realtime indisponible
    const interval = setInterval(() => void load(), 20000);
    return () => {
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [estId, load]);

  async function openAssign(o: OrderWithItems) {
    if (!estId) return;
    setAssignOrder(o);
    const list = await loadServerCandidates(estId);
    setCandidates(list);
  }

  async function confirmAssign(cnd: ServerCandidate | null, auto = false) {
    if (!assignOrder || !estId) return;
    setAssignBusy(true);
    if (auto) {
      await autoAssignOrder(estId, assignOrder.id, assignOrder.table_id);
    } else if (cnd) {
      await assignServerToOrder({
        orderId: assignOrder.id,
        serverId: cnd.user_id,
        serverName: cnd.full_name,
        tableId: assignOrder.table_id,
      });
    }
    setAssignBusy(false);
    setAssignOrder(null);
    setMsg('Serveur attribué');
    await load();
  }

  async function advanceOrder(o: OrderWithItems) {
    const next: Record<string, string> = {
      pending: 'preparing',
      preparing: 'ready',
      ready: 'ready',
    };
    if (o.status === 'ready') {
      openClose(o);
      setPay('cash');
      return;
    }
    await supabase.from('orders').update({ status: next[o.status] }).eq('id', o.id);
    if (o.items) {
      for (const item of o.items) {
        await supabase.from('order_items').update({ status: next[o.status] }).eq('id', item.id);
      }
    }
    // Nouvelle commande : proposer serveurs si pas encore attribué
    if (o.status === 'pending' && !(o as any).server_id) {
      await load();
      await openAssign({ ...o, status: 'preparing' });
      return;
    }
    await load();
  }

  async function confirmClose() {
    if (!closeFor || !estId) return;
    setBusy(true);
    setMsg(null);
    let res: { ok: boolean; error?: string };
    if (splitMode && splitIds.length > 0) {
      res = await closeOrderLinesPartial({
        establishmentId: estId,
        orderId: closeFor.id,
        tableId: closeFor.table_id,
        itemIds: splitIds,
        payment: pay,
        pushToLiveSales: true,
      });
    } else {
      res = await closeTableOrders({
        establishmentId: estId,
        orderIds: [closeFor.id],
        tableId: closeFor.table_id,
        payment: pay,
        paidAmount: Number(closeFor.total) || 0,
        pushToLiveSales: true,
      });
    }
    setBusy(false);
    if (!res.ok) {
      setMsg(res.error || 'Erreur clôture');
      return;
    }
    setCloseFor(null);
    setSplitMode(false);
    setSplitIds([]);
    setMsg(
      splitMode
        ? 'Partie de l’addition encaissée · stock mis à jour'
        : 'Table/commande clôturée · stock mis à jour · vente enregistrée',
    );
    await load();
  }

  async function setItemStatus(itemId: string, status: string) {
    await supabase.from('order_items').update({ status }).eq('id', itemId);
    await load();
  }

  function openClose(o: OrderWithItems) {
    setCloseFor(o);
    setSplitMode(false);
    setSplitIds([]);
    setPay('cash');
  }


  if (loading) {
    return <div className="flex justify-center py-20 text-stone-400">Chargement cuisine…</div>;
  }

  const pending = orders.filter((o) => o.status === 'pending').length;
  const preparing = orders.filter((o) => o.status === 'preparing').length;
  const ready = orders.filter((o) => o.status === 'ready').length;

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-stone-100 flex items-center gap-2">
          <ChefHat className="text-amber-400" /> Cuisine / Bar
        </h1>
        <span className="text-xs text-stone-500 flex items-center gap-1">
          <Bell size={12} /> Temps réel
        </span>
      </div>

      {flash && (
        <div className="rounded-xl border-2 border-red-500 bg-red-600 text-white px-4 py-3 font-bold text-center animate-pulse shadow-lg shadow-red-900/40">
          🔔 Nouvelle commande — regardez la file
        </div>
      )}

      {!alertArmed && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
          <p className="text-sm text-red-100">
            Activez le <strong>son</strong> et les <strong>notifications</strong> pour être alerté à chaque commande.
          </p>
          <button
            type="button"
            className="shrink-0 min-h-[44px] px-4 rounded-xl bg-red-600 text-white font-bold text-sm"
            onClick={async () => {
              const r = await requestOrderAlertPermissions();
              setAlertArmed(Boolean(r.sound || r.notification === 'granted'));
              if (r.sound) playOrderAlertSound();
              setMsg(
                r.notification === 'granted'
                  ? 'Alertes son + notification activées'
                  : r.sound
                    ? 'Son activé (notifications navigateur refusées ou indisponibles)'
                    : 'Impossible d’activer les alertes — vérifiez les permissions du navigateur',
              );
            }}
          >
            Autoriser alertes
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-3 text-center">
          <p className="text-[10px] text-stone-500 uppercase">Nouvelles</p>
          <p className="text-xl font-bold text-amber-300">{pending}</p>
        </div>
        <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-3 text-center">
          <p className="text-[10px] text-stone-500 uppercase">Préparation</p>
          <p className="text-xl font-bold text-sky-300">{preparing}</p>
        </div>
        <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-3 text-center">
          <p className="text-[10px] text-stone-500 uppercase">Prêtes</p>
          <p className="text-xl font-bold text-emerald-300">{ready}</p>
        </div>
      </div>

      {msg && (
        <p className="text-sm rounded-xl border border-stone-700 bg-stone-900 px-3 py-2 text-stone-200">
          {msg}
        </p>
      )}

      {orders.length === 0 ? (
        <EmptyState
          icon={<UtensilsCrossed size={48} />}
          title="Aucune commande en cours"
          message="Les commandes QR / table apparaîtront ici en direct."
        />
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div
              key={o.id}
              className={`rounded-2xl border p-4 ${
                o.status === 'pending'
                  ? 'border-amber-500/40 bg-amber-500/5'
                  : o.status === 'preparing'
                    ? 'border-sky-500/40 bg-sky-500/5'
                    : 'border-emerald-500/40 bg-emerald-500/5'
              }`}
            >
              <div className="flex justify-between gap-2 mb-2">
                <div>
                  <p className="font-bold text-stone-100">
                    Table {o.table_number || '—'}{' '}
                    <span className="text-xs font-normal text-stone-500">
                      {o.source === 'qr_table' ? '· QR client' : ''}
                    </span>
                  </p>
                  <p className="text-xs text-stone-500">
                    {formatTime(o.created_at)} · {ORDER_STATUS_LABELS[o.status] || o.status}
                  </p>
                  <p className="text-xs text-amber-300/90 mt-0.5">
                    {(o as any).server_name
                      ? `👤 ${(o as any).server_name}`
                      : '👤 Non attribué'}
                  </p>
                </div>
                <Badge
                  color={
                    o.status === 'pending' ? 'warning' : o.status === 'preparing' ? 'primary' : 'success'
                  }
                >
                  {ORDER_STATUS_LABELS[o.status] || o.status}
                </Badge>
              </div>
              <ul className="text-sm text-stone-200 space-y-2 mb-3">
                {(o.items || []).map((it) => (
                  <li key={it.id} className="flex flex-wrap justify-between gap-2 items-center">
                    <span>
                      {it.product_name} × {it.qty}
                      <span className="text-[10px] text-stone-500 ml-1">{it.status || 'pending'}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="font-mono text-amber-300/90">
                        {formatFCFA(it.qty * Number(it.unit_price))}
                      </span>
                      {it.status !== 'served' && it.status !== 'ready' && (
                        <button
                          type="button"
                          className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-300"
                          onClick={() => void setItemStatus(it.id, 'ready')}
                        >
                          Prêt
                        </button>
                      )}
                      {it.status === 'ready' && (
                        <button
                          type="button"
                          className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-300"
                          onClick={() => void setItemStatus(it.id, 'served')}
                        >
                          Servi
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="font-bold text-amber-300">{formatFCFA(Number(o.total) || 0)}</p>
                <div className="flex gap-1">
                <button
                  type="button"
                  className="btn-secondary text-xs min-h-[40px] px-2"
                  onClick={() => void openAssign(o)}
                >
                  Serveur
                </button>
                <button
                  type="button"
                  className="btn-primary text-sm min-h-[40px] px-4"
                  onClick={() => void advanceOrder(o)}
                >
                  {o.status === 'pending' && (
                    <>
                      <Clock size={14} className="inline mr-1" /> Préparer
                    </>
                  )}
                  {o.status === 'preparing' && (
                    <>
                      <CheckCircle2 size={14} className="inline mr-1" /> Prête
                    </>
                  )}
                  {o.status === 'ready' && (
                    <>
                      <Wallet size={14} className="inline mr-1" /> Encaisser / clôturer
                    </>
                  )}
                </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {assignOrder && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-stone-700 bg-stone-950 p-5 space-y-3 max-h-[85vh] overflow-y-auto">
            <h2 className="font-bold text-lg text-stone-100">
              Attribuer un serveur — Table {assignOrder.table_number || '—'}
            </h2>
            <p className="text-sm text-stone-400">
              Suggestions selon la charge (tables + commandes ouvertes). Les serveurs « en service » sont prioritaires.
            </p>
            <button
              type="button"
              className="btn-primary w-full min-h-[44px]"
              disabled={assignBusy}
              onClick={() => void confirmAssign(null, true)}
            >
              Attribution auto (moins chargé)
            </button>
            <div className="space-y-2">
              {(suggestServers(candidates, 5).length ? suggestServers(candidates, 8) : candidates).map((cnd) => (
                <button
                  key={cnd.user_id}
                  type="button"
                  disabled={assignBusy}
                  onClick={() => void confirmAssign(cnd)}
                  className={`w-full text-left rounded-xl border px-3 py-3 ${
                    cnd.on_duty
                      ? 'border-amber-500/40 bg-amber-500/10'
                      : 'border-stone-800 bg-stone-900 opacity-70'
                  }`}
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold text-stone-100">{cnd.full_name}</span>
                    <span className="text-[10px] text-stone-500">
                      {cnd.on_duty ? 'En service' : 'Hors service'}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 mt-1">
                    {cnd.open_tables} table(s) · {cnd.open_orders} commande(s) active(s)
                    {cnd === suggestServers(candidates, 1)[0] ? ' · recommandé' : ''}
                  </p>
                </button>
              ))}
              {candidates.length === 0 && (
                <p className="text-sm text-stone-500">Aucun membre actif — créez des accès employés.</p>
              )}
            </div>
            <button type="button" className="btn-secondary w-full" onClick={() => setAssignOrder(null)}>
              Plus tard
            </button>
          </div>
        </div>
      )}

      {closeFor && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-stone-700 bg-stone-950 p-5 space-y-3">
            <h2 className="font-bold text-lg text-stone-100">Clôture table {closeFor.table_number || ''}</h2>
            <p className="text-sm text-stone-400">
              Paiement + décrément stock + enregistrement vente journée
            </p>
            <p className="text-2xl font-bold text-amber-300">
              {formatFCFA(
                splitMode && splitIds.length
                  ? (closeFor.items || [])
                      .filter((it) => splitIds.includes(it.id))
                      .reduce((s, it) => s + Number(it.qty) * Number(it.unit_price), 0)
                  : Number(closeFor.total) || 0,
              )}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className={`flex-1 py-2 rounded-xl text-xs font-semibold ${
                  !splitMode ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-stone-300'
                }`}
                onClick={() => {
                  setSplitMode(false);
                  setSplitIds([]);
                }}
              >
                Addition complète
              </button>
              <button
                type="button"
                className={`flex-1 py-2 rounded-xl text-xs font-semibold ${
                  splitMode ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-stone-300'
                }`}
                onClick={() => setSplitMode(true)}
              >
                Scission (par plats)
              </button>
            </div>
            {splitMode && (
              <div className="space-y-1 max-h-40 overflow-y-auto border border-stone-700 rounded-xl p-2">
                {(closeFor.items || [])
                  .filter((it) => it.status !== 'served')
                  .map((it) => (
                    <label key={it.id} className="flex items-center gap-2 text-sm text-stone-200">
                      <input
                        type="checkbox"
                        checked={splitIds.includes(it.id)}
                        onChange={(e) => {
                          setSplitIds((prev) =>
                            e.target.checked ? [...prev, it.id] : prev.filter((x) => x !== it.id),
                          );
                        }}
                      />
                      <span className="flex-1">
                        {it.product_name} × {it.qty}
                      </span>
                      <span className="text-amber-300">
                        {formatFCFA(Number(it.qty) * Number(it.unit_price))}
                      </span>
                    </label>
                  ))}
              </div>
            )}
            <div className="flex gap-2">
              {(
                [
                  ['cash', 'Espèces'],
                  ['mobile', 'Mobile'],
                  ['mixed', 'Mixte'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPay(id)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold ${
                    pay === id ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-stone-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setCloseFor(null)}>
                Annuler
              </button>
              <button
                type="button"
                className="btn-primary flex-1 min-h-[44px] flex items-center justify-center gap-2"
                disabled={busy || (splitMode && splitIds.length === 0)}
                onClick={() => void confirmClose()}
              >
                {busy ? <Loader2 className="animate-spin" size={16} /> : <Wallet size={16} />}
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
