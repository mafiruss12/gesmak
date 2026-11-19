import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Receipt, Plus, Trash2, ShoppingBag, CheckCircle2, Clock, UtensilsCrossed, X, UserCog, RefreshCw,
  Search, Wallet, Ban, AlertCircle, StickyNote,
} from 'lucide-react';
import { addTicket, type LivePayMethod } from '@/lib/liveDaySales';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Product, RestaurantTable, Order, OrderItem, EstablishmentPole } from '@/lib/types';
import { ORDER_STATUS_LABELS, ORDER_TYPE_LABELS } from '@/lib/types';
import { formatFCFA, formatTime } from '@/lib/format';
import { Modal, EmptyState, Badge } from '@/components/ui';
import ProductThumb from '@/components/ProductThumb';
import { ReceiptPrintModal } from '@/components/ReceiptPrint';
import {
  loadServerCandidates,
  assignServerToOrder,
  type ServerCandidate,
} from '@/lib/serverDispatch';
import { closeTableOrders, closeOrderLinesPartial, type ClosePay } from '@/lib/tableClose';
import { listEstablishmentPoles, poleLabel, resolveLockedPole } from '@/lib/poles';
import { getActiveSessionId } from '@/lib/serviceDay';
import { listCategories, listMenuItems, listOptions, type MenuCategory, type MenuItem, type MenuItemOption } from '@/lib/restaurant';

type CartLine =
  | { kind: 'product'; product: Product; qty: number }
  | { kind: 'menu'; item: MenuItem; qty: number; notes?: string; options?: { name: string; price_delta: number }[] };

type OrderRow = Order & {
  customer_name?: string | null;
  server_id?: string | null;
  server_name?: string | null;
  source?: string | null;
  table_id?: string | null;
  table_number?: string | null;
  pole_code?: string | null;
  payment_method?: string | null;
  paid_at?: string | null;
  paid_amount?: number | null;
  stock_deducted?: boolean | null;
};

type OrderItemExtended = OrderItem & {
  notes?: string | null;
};

type PayChoice = 'cash' | 'wave' | 'orange_money' | 'mtn_money' | 'card' | 'mixed';

const PAY_CHOICES: { id: PayChoice; label: string; closePay: ClosePay; livePay: LivePayMethod }[] = [
  { id: 'cash', label: 'Espèces', closePay: 'cash', livePay: 'cash' },
  { id: 'wave', label: 'Wave', closePay: 'mobile', livePay: 'mobile' },
  { id: 'orange_money', label: 'Orange Money', closePay: 'mobile', livePay: 'mobile' },
  { id: 'mtn_money', label: 'MTN Money', closePay: 'mobile', livePay: 'mobile' },
  { id: 'card', label: 'Carte', closePay: 'mixed', livePay: 'mixed' },
  { id: 'mixed', label: 'Mixte', closePay: 'mixed', livePay: 'mixed' },
];

const CANCEL_MOTIFS = [
  'Client parti',
  'Rupture de stock',
  'Erreur de saisie',
  'Commande en doublon',
];

function payChoiceLabel(pm?: string | null): string {
  if (!pm) return 'Payée';
  const low = pm.toLowerCase();
  if (low === 'cash') return 'Espèces';
  if (low === 'wave') return 'Wave';
  if (low === 'orange_money') return 'Orange';
  if (low === 'mtn_money') return 'MTN';
  if (low === 'mobile' || low === 'mobile_money') return 'Mobile Money';
  if (low === 'card') return 'Carte';
  if (low === 'mixed') return 'Mixte';
  return pm;
}

function slaMinutes(createdAt: string, nowMs: number): { label: string; mins: number; cls: string } {
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return { label: '—', mins: 0, cls: 'bg-stone-800 text-stone-300 border-stone-700' };
  const mins = Math.max(0, Math.floor((nowMs - t) / 60000));
  const label = mins < 1 ? '<1 min' : mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}`;
  const cls =
    mins >= 20
      ? 'bg-rose-500/15 text-rose-300 border-rose-500/35'
      : mins >= 10
        ? 'bg-amber-500/15 text-amber-300 border-amber-500/35'
        : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35';
  return { label, mins, cls };
}

function lineKey(l: CartLine) {
  return l.kind === 'product' ? `p:${l.product.id}` : `m:${l.item.id}`;
}

function linePrice(l: CartLine) {
  if (l.kind === 'product') return Number(l.product.price);
  const opt = (l.options || []).reduce((s, o) => s + Number(o.price_delta || 0), 0);
  return Number(l.item.price) + opt;
}

function lineName(l: CartLine) {
  if (l.kind === 'product') return l.product.name;
  const opt = (l.options || []).map((o) => o.name).filter(Boolean);
  return opt.length ? `${l.item.name} (${opt.join(', ')})` : l.item.name;
}

export default function Orders() {
  const { member, user, effectiveRole, activeEstablishment } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const lockedPole = resolveLockedPole(member, effectiveRole);
  const [searchParams, setSearchParams] = useSearchParams();
  const canAssign = ['super_admin', 'admin', 'owner', 'manager'].includes(
    String(effectiveRole || member?.role || ''),
  );

  const [products, setProducts] = useState<Product[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [poles, setPoles] = useState<EstablishmentPole[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, OrderItemExtended[]>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'open' | 'pending' | 'preparing' | 'ready' | 'unpaid' | 'paid' | 'cancelled' | 'all'>('open');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [pendingCount, setPendingCount] = useState(0);

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [catalogTab, setCatalogTab] = useState<'carte' | 'stock'>('carte');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'delivery'>('dine_in');
  const [tableId, setTableId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [selectedPole, setSelectedPole] = useState(lockedPole || '');
  const [selectedServerId, setSelectedServerId] = useState('');
  const [notes, setNotes] = useState('');
  const [modalErr, setModalErr] = useState<string | null>(null);

  const [servers, setServers] = useState<ServerCandidate[]>([]);
  const [assignOrderId, setAssignOrderId] = useState<string | null>(null);
  const [assignBusy, setAssignBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [appendOrderId, setAppendOrderId] = useState<string | null>(null);
  const [optItem, setOptItem] = useState<MenuItem | null>(null);
  const [optList, setOptList] = useState<MenuItemOption[]>([]);
  const [optSelected, setOptSelected] = useState<string[]>([]);

  const [detail, setDetail] = useState<OrderRow | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<OrderRow | null>(null);
  const [cancelOrder, setCancelOrder] = useState<OrderRow | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);

  const [payOrder, setPayOrder] = useState<OrderRow | null>(null);
  const [payChoice, setPayChoice] = useState<PayChoice>('cash');
  const [splitMode, setSplitMode] = useState(false);
  const [splitIds, setSplitIds] = useState<string[]>([]);
  const [payBusy, setPayBusy] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (lockedPole) setSelectedPole(lockedPole);
  }, [lockedPole]);

  const load = useCallback(async () => {
    if (!estId) {
      setLoading(false);
      return;
    }
    try {
      const [prodRes, tabRes, ordRes, cats, items, poleList] = await Promise.all([
        supabase.from('products').select('*').eq('establishment_id', estId).order('name'),
        supabase.from('restaurant_tables').select('*').eq('establishment_id', estId).order('number'),
        (() => {
          let q = supabase
            .from('orders')
            .select('*')
            .eq('establishment_id', estId)
            .order('created_at', { ascending: false })
            .limit(200);
          if (dateFilter) {
            q = q.gte('created_at', `${dateFilter}T00:00:00`).lte('created_at', `${dateFilter}T23:59:59.999`);
          }
          return q;
        })(),
        listCategories(estId).catch(() => [] as MenuCategory[]),
        listMenuItems(estId).catch(() => [] as MenuItem[]),
        listEstablishmentPoles(estId).catch(() => [] as EstablishmentPole[]),
      ]);

      setProducts((prodRes.data ?? []) as Product[]);
      setTables((tabRes.data ?? []) as RestaurantTable[]);
      const ordList = (ordRes.data ?? []) as OrderRow[];
      setOrders(ordList);
      setPendingCount(ordList.filter((o) => o.status === 'pending').length);
      setCategories(cats);
      setMenuItems(items.filter((i) => i.is_available));
      setPoles(poleList);

      // Précharger les lignes d'articles pour affichage inline pro
      const activeIds = ordList.slice(0, 60).map((o) => o.id);
      if (activeIds.length) {
        const { data: oi } = await supabase
          .from('order_items')
          .select('*')
          .in('order_id', activeIds);
        const grouped: Record<string, OrderItemExtended[]> = {};
        for (const row of (oi || []) as Array<{
          id: string;
          order_id: string;
          product_id?: string | null;
          product_name?: string | null;
          name?: string | null;
          qty?: number | null;
          quantity?: number | null;
          unit_price?: number | null;
          status?: string | null;
          notes?: string | null;
        }>) {
          const mapped: OrderItemExtended = {
            id: row.id,
            order_id: row.order_id,
            product_id: row.product_id || null,
            product_name: row.product_name || row.name || 'Article',
            qty: Number(row.qty ?? row.quantity) || 1,
            unit_price: Number(row.unit_price) || 0,
            status: (row.status as OrderItem['status']) || 'pending',
            notes: row.notes || null,
          };
          (grouped[row.order_id] ||= []).push(mapped);
        }
        setItemsByOrder(grouped);
      } else {
        setItemsByOrder({});
      }

      const cands = await loadServerCandidates(estId);
      setServers(cands);
    } finally {
      setLoading(false);
    }
  }, [estId, dateFilter]);

  const reloadTimerRef = useRef<number | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!estId) return;
    const scheduleReload = () => {
      if (reloadTimerRef.current != null) window.clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = window.setTimeout(() => {
        reloadTimerRef.current = null;
        void load();
      }, 350);
    };
    const ch = supabase
      .channel(`orders-live-${estId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `establishment_id=eq.${estId}` },
        scheduleReload,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        scheduleReload,
      )
      .subscribe();
    return () => {
      if (reloadTimerRef.current != null) window.clearTimeout(reloadTimerRef.current);
      void supabase.removeChannel(ch);
    };
  }, [estId, load]);

  useEffect(() => {
    const tid = searchParams.get('table');
    const oid = searchParams.get('order');
    if (oid) {
      setAppendOrderId(oid);
      setModalOpen(true);
    }
    if (tid && tables.length) {
      const t = tables.find((x) => String(x.number) === tid || x.id === tid);
      if (t) {
        setTableId(t.id);
        setOrderType('dine_in');
        if (!oid) setModalOpen(true);
      }
    }
  }, [searchParams, tables]);

  const productByName = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of products) m.set(p.name.trim().toLowerCase(), p);
    return m;
  }, [products]);

  const productById = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  const cartTotal = useMemo(
    () => cart.reduce((s, i) => s + linePrice(i) * i.qty, 0),
    [cart],
  );

  function addProduct(p: Product) {
    setCart((prev) => {
      const key = `p:${p.id}`;
      const ex = prev.find((i) => lineKey(i) === key);
      if (ex) return prev.map((i) => (lineKey(i) === key ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { kind: 'product', product: p, qty: 1 }];
    });
  }

  async function addMenu(item: MenuItem) {
    try {
      const opts = await listOptions(item.id);
      if (opts.length) {
        setOptItem(item);
        setOptList(opts);
        setOptSelected([]);
        return;
      }
    } catch {
      /* ignore */
    }
    setCart((prev) => {
      const key = `m:${item.id}`;
      const ex = prev.find((i) => lineKey(i) === key && !(i.kind === 'menu' && (i.options || []).length));
      if (ex) return prev.map((i) => (lineKey(i) === key && i === ex ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { kind: 'menu', item, qty: 1, options: [] }];
    });
  }

  function confirmMenuOptions() {
    if (!optItem) return;
    const selected = optList
      .filter((o) => optSelected.includes(o.id))
      .map((o) => ({ name: o.name, price_delta: Number(o.price_delta) || 0 }));
    setCart((prev) => [...prev, { kind: 'menu', item: optItem, qty: 1, options: selected }]);
    setOptItem(null);
    setOptList([]);
    setOptSelected([]);
  }

  function updateQty(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) => (lineKey(i) === key ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0),
    );
  }

  async function createOrder(immediatePayMethod?: PayChoice) {
    if (!estId || cart.length === 0) return;
    setBusy(true);
    setModalErr(null);
    try {
      const orderId = appendOrderId;
      if (orderId) {
        const batchRows = cart.map((i) =>
          i.kind === 'product'
            ? {
                order_id: orderId,
                product_id: i.product.id,
                product_name: i.product.name,
                qty: i.qty,
                unit_price: i.product.price,
                status: 'pending',
              }
            : {
                order_id: orderId,
                product_id: i.item.linked_product_id || null,
                product_name: i.item.name,
                qty: i.qty,
                unit_price: linePrice(i),
                status: 'pending',
                menu_item_id: i.item.id,
                selected_options: i.options || [],
                notes: i.notes || null,
              },
        );
        const { error: itemErr } = await supabase.from('order_items').insert(batchRows);
        if (itemErr) {
          setModalErr(itemErr.message || 'Ajout articles impossible.');
          return;
        }
        const { data: items } = await supabase
          .from('order_items')
          .select('qty, unit_price')
          .eq('order_id', orderId);
        const total = ((items || []) as Array<{ qty?: number | null; unit_price?: number | null }>)
          .reduce((s, it) => s + Number(it.qty ?? 1) * Number(it.unit_price || 0), 0);
        const existing = orders.find((o) => o.id === orderId);
        const mergedNotes = [existing?.notes?.trim(), notes.trim()].filter(Boolean).join(' · ') || null;
        await supabase.from('orders').update({ total, status: 'pending', notes: mergedNotes }).eq('id', orderId);
        setFeedback({ ok: true, text: 'Tour ajouté à la commande et envoyé en cuisine/bar.' });
      } else {
        const table = tables.find((t) => t.id === tableId);
        const srv = servers.find((s) => s.user_id === selectedServerId);
        const nowIso = new Date().toISOString();
        const isInstantPay = Boolean(immediatePayMethod);
        const { data: order, error } = await supabase
          .from('orders')
          .insert({
            establishment_id: estId,
            table_id: tableId || null,
            table_number: table ? String(table.number) : null,
            customer_name: customerName.trim() || null,
            status: isInstantPay ? 'served' : 'pending',
            order_type: orderType,
            pole_code: selectedPole || null,
            total: cartTotal,
            notes: notes.trim() || null,
            source: 'staff',
            created_by: user?.id || null,
            server_id: srv?.user_id || user?.id || null,
            server_name: srv?.full_name || member?.full_name || null,
            ...(isInstantPay ? { payment_method: immediatePayMethod, paid_at: nowIso } : {}),
          })
          .select('id')
          .maybeSingle();
        if (error || !order?.id) {
          setModalErr(error?.message || 'Création de la commande impossible.');
          return;
        }
        const batchRows = cart.map((i) =>
          i.kind === 'product'
            ? {
                order_id: order.id,
                product_id: i.product.id,
                product_name: i.product.name,
                qty: i.qty,
                unit_price: i.product.price,
                status: isInstantPay ? 'served' : 'pending',
              }
            : {
                order_id: order.id,
                product_id: i.item.linked_product_id || null,
                product_name: i.item.name,
                qty: i.qty,
                unit_price: linePrice(i),
                status: isInstantPay ? 'served' : 'pending',
                menu_item_id: i.item.id,
                selected_options: i.options || [],
                notes: i.notes || null,
              },
        );
        const { error: itemsErr } = await supabase.from('order_items').insert(batchRows);
        if (itemsErr) {
          setModalErr(itemsErr.message || 'Articles non enregistrés.');
          return;
        }
        if (isInstantPay && immediatePayMethod) {
          const cfg = PAY_CHOICES.find((p) => p.id === immediatePayMethod) || PAY_CHOICES[0];
          const sessionId = await getActiveSessionId(estId);
          const canonicalPm: 'cash' | 'mobile_money' | 'other' =
            immediatePayMethod === 'cash'
              ? 'cash'
              : ['wave', 'orange_money', 'mtn_money'].includes(immediatePayMethod)
                ? 'mobile_money'
                : 'other';
          await Promise.all(
            cart.map(async (i) => {
              const pid = i.kind === 'product' ? i.product.id : i.item.linked_product_id;
              if (!pid) return;
              const unitP = linePrice(i);
              const salePayload = {
                establishment_id: estId,
                product_id: pid,
                qty: i.qty,
                unit_price: unitP,
                total: i.qty * unitP,
                payment_method: immediatePayMethod,
                created_by: user?.id || null,
                pole_code: selectedPole || null,
                cash_session_id: sessionId || null,
              };
              const { error: sErr } = await supabase.from('sales').insert(salePayload);
              if (sErr && immediatePayMethod !== canonicalPm) {
                await supabase.from('sales').insert({ ...salePayload, payment_method: canonicalPm });
              }
              const prod = productById.get(pid);
              if (prod) {
                await supabase
                  .from('products')
                  .update({ stock: Math.max(0, Number(prod.stock || 0) - i.qty) })
                  .eq('id', pid);
              }
            }),
          );
          setFeedback({ ok: true, text: `Commande créée & encaissée immédiatement (${cfg.label}).` });
        } else {
          if (tableId) {
            await supabase.from('restaurant_tables').update({ status: 'occupied' }).eq('id', tableId);
          }
          setFeedback({ ok: true, text: 'Commande créée et transmise au service.' });
        }
      }
      setCart([]);
      setNotes('');
      setCustomerName('');
      setTableId('');
      setAppendOrderId(null);
      setModalOpen(false);
      setSearchParams({});
      void load();
    } finally {
      setBusy(false);
    }
  }

  async function sendToKitchen(id: string) {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: 'preparing' } : o)));
    setItemsByOrder((prev) => ({
      ...prev,
      [id]: (prev[id] || []).map((it) => (it.status === 'pending' ? { ...it, status: 'preparing' } : it)),
    }));
    setFeedback({ ok: true, text: 'Commande envoyée en préparation.' });
    await Promise.all([
      supabase.from('orders').update({ status: 'preparing' }).eq('id', id),
      supabase.from('order_items').update({ status: 'preparing' }).eq('order_id', id).eq('status', 'pending'),
    ]);
  }

  async function updateStatus(id: string, status: string) {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: status as Order['status'] } : o)));
    if (status === 'ready' || status === 'served') {
      setItemsByOrder((prev) => ({
        ...prev,
        [id]: (prev[id] || []).map((it) => (it.status !== 'served' ? { ...it, status: status as OrderItem['status'] } : it)),
      }));
    }
    setFeedback({
      ok: true,
      text: status === 'ready' ? 'Commande marquée prête.' : status === 'served' ? 'Commande servie — prête pour encaissement.' : 'Statut mis à jour.',
    });
    await supabase.from('orders').update({ status }).eq('id', id);
    if (status === 'ready' || status === 'served') {
      await supabase
        .from('order_items')
        .update({ status })
        .eq('order_id', id)
        .neq('status', 'served');
    }
  }

  async function cycleItemStatus(item: OrderItemExtended) {
    const next =
      item.status === 'pending'
        ? 'preparing'
        : item.status === 'preparing'
          ? 'ready'
          : item.status === 'ready'
            ? 'served'
            : 'pending';
    setItemsByOrder((prev) => ({
      ...prev,
      [item.order_id]: (prev[item.order_id] || []).map((it) => (it.id === item.id ? { ...it, status: next } : it)),
    }));
    await supabase.from('order_items').update({ status: next }).eq('id', item.id);
  }

  async function assignServer(order: OrderRow, server: ServerCandidate) {
    setAssignBusy(true);
    await assignServerToOrder({
      orderId: order.id,
      serverId: server.user_id,
      serverName: server.full_name,
      tableId: order.table_id || null,
    });
    setAssignBusy(false);
    setAssignOrderId(null);
    setFeedback({ ok: true, text: `Serveur ${server.full_name} attribué.` });
    void load();
  }

  async function confirmCancel() {
    if (!cancelOrder || !estId) return;
    setCancelBusy(true);
    const reason = cancelReason.trim() || 'Annulation opérateur';
    const merged = [cancelOrder.notes?.trim(), `[Annulée : ${reason}]`].filter(Boolean).join(' · ');
    const { error } = await supabase
      .from('orders')
      .update({ status: 'cancelled', notes: merged })
      .eq('id', cancelOrder.id);

    if (!error) {
      if (cancelOrder.table_id) {
        await supabase.from('restaurant_tables').update({ status: 'free' }).eq('id', cancelOrder.table_id);
      }
      await supabase.from('operation_audit').insert({
        establishment_id: estId,
        actor_id: user?.id || null,
        actor_name: member?.full_name || member?.email || 'Équipe',
        action: 'order.cancel',
        entity_type: 'order',
        entity_id: cancelOrder.id,
        entity_label: cancelOrder.table_number ? `Table ${cancelOrder.table_number}` : `Commande #${cancelOrder.id.slice(0, 6)}`,
        reason,
      });
      setFeedback({ ok: true, text: `Commande annulée (${reason}).` });
    } else {
      setFeedback({ ok: false, text: error.message });
    }
    setCancelBusy(false);
    setCancelOrder(null);
    setCancelReason('');
    void load();
  }

  function openPayModal(o: OrderRow) {
    setPayOrder(o);
    setPayChoice('cash');
    setSplitMode(false);
    const items = itemsByOrder[o.id] || [];
    setSplitIds(items.filter((i) => i.status !== 'served').map((i) => i.id));
  }

  async function confirmCloseAndPay() {
    if (!payOrder || !estId) return;
    setPayBusy(true);
    try {
      const cfg = PAY_CHOICES.find((p) => p.id === payChoice) || PAY_CHOICES[0];
      const allItems = itemsByOrder[payOrder.id] || [];
      const unpaidItems = allItems.filter((i) => i.status !== 'served');
      const isPartial = splitMode && splitIds.length > 0 && splitIds.length < unpaidItems.length;
      const targetItems = isPartial
        ? allItems.filter((i) => splitIds.includes(i.id))
        : (unpaidItems.length ? unpaidItems : allItems);

      const sessionId = await getActiveSessionId(estId);

      // 1. Insérer les lignes dans `sales` (caisse & bilans) + `stock_movements`
      const canonicalPm: 'cash' | 'mobile_money' | 'other' =
        payChoice === 'cash'
          ? 'cash'
          : ['wave', 'orange_money', 'mtn_money'].includes(payChoice)
            ? 'mobile_money'
            : 'other';

      if (!payOrder.stock_deducted || isPartial) {
        for (const it of targetItems) {
          if (!it.product_id) continue;
          const prod = productById.get(it.product_id);
          const salePayload: Record<string, unknown> = {
            establishment_id: estId,
            product_id: it.product_id,
            qty: it.qty,
            unit_price: it.unit_price,
            total: Number(it.qty) * Number(it.unit_price),
            payment_method: payChoice,
            created_by: user?.id || null,
            pole_code: payOrder.pole_code || lockedPole || null,
            cash_session_id: sessionId || null,
          };
          const { error: sErr } = await supabase.from('sales').insert(salePayload);
          if (sErr && payChoice !== canonicalPm) {
            await supabase.from('sales').insert({ ...salePayload, payment_method: canonicalPm });
          }
          await supabase.from('stock_movements').insert({
            establishment_id: estId,
            product_id: it.product_id,
            product_name: it.product_name,
            qty: -it.qty,
            movement_type: 'pos_sale',
            unit_cost: prod?.cost || 0,
            unit_price: it.unit_price,
            reason: 'commande',
            note: `Encaissement ${payOrder.table_number ? `Table ${payOrder.table_number}` : `#${payOrder.id.slice(0, 6)}`} (${cfg.label})`,
            created_by: user?.id || null,
          });
        }
      }

      // 2. Clôturer commande & décrémenter stock via lib tableClose + sync liveDaySales
      let res: { ok: boolean; error?: string };
      if (isPartial) {
        res = await closeOrderLinesPartial({
          establishmentId: estId,
          orderId: payOrder.id,
          tableId: payOrder.table_id,
          itemIds: splitIds,
          payment: cfg.closePay,
          pushToLiveSales: true,
        });
      } else {
        res = await closeTableOrders({
          establishmentId: estId,
          orderIds: [payOrder.id],
          tableId: payOrder.table_id,
          payment: cfg.closePay,
          paidAmount: Number(payOrder.total) || 0,
          pushToLiveSales: true,
        });
      }

      // 3. Conserver le mode de paiement exact (wave/orange/mtn/card...) si tableClose a écrit 'mobile'/'mixed'
      if (res.ok && !isPartial && payChoice !== cfg.closePay) {
        await supabase.from('orders').update({ payment_method: payChoice }).eq('id', payOrder.id);
      }

      // 4. Trace liveDaySales si aucun item n'avait product_id
      if (res.ok && targetItems.every((i) => !i.product_id)) {
        const today = new Date().toISOString().split('T')[0];
        addTicket(
          estId,
          today,
          [{
            product_id: payOrder.id,
            name: `Commande ${payOrder.table_number ? `T.${payOrder.table_number}` : `#${payOrder.id.slice(0, 6)}`}`,
            category: 'Commande',
            price: Math.round(Number(payOrder.total) || 0),
            cost: 0,
            qty: 1,
          }],
          cfg.livePay,
          `Encaissement ${cfg.label}`,
          member?.full_name || member?.role || 'equipe',
          true,
          `order:${payOrder.id}`,
        );
      }

      if (!res.ok) {
        setFeedback({ ok: false, text: res.error || 'Encaissement refusé.' });
      } else {
        setFeedback({
          ok: true,
          text: isPartial
            ? `Addition partielle encaissée (${cfg.label}) — reliquat ouvert.`
            : `Addition encaissée (${cfg.label}) — table libérée & stock mis à jour.`,
        });
        setPayOrder(null);
      }
      await load();
    } finally {
      setPayBusy(false);
    }
  }

  function clientLabel(o: OrderRow) {
    if (o.customer_name) return o.customer_name;
    const n = String(o.notes || '');
    const m = n.match(/Client:\s*([^·]+)/i);
    return m ? m[1].trim() : null;
  }

  const boardCounts = useMemo(() => ({
    pending: orders.filter((o) => o.status === 'pending').length,
    preparing: orders.filter((o) => o.status === 'preparing').length,
    ready: orders.filter((o) => o.status === 'ready').length,
    unpaid: orders.filter((o) => o.status === 'served' && !o.paid_at).length,
    activeTotal: orders
      .filter((o) => o.status !== 'cancelled' && !o.paid_at)
      .reduce((s, o) => s + (Number(o.total) || 0), 0),
  }), [orders]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orders.filter((o) => {
      const matchTab =
        statusFilter === 'open'
          ? ['pending', 'preparing', 'ready'].includes(o.status) || (o.status === 'served' && !o.paid_at)
          : statusFilter === 'pending'
            ? o.status === 'pending'
            : statusFilter === 'preparing'
              ? o.status === 'preparing'
              : statusFilter === 'ready'
                ? o.status === 'ready'
                : statusFilter === 'unpaid'
                  ? o.status === 'served' && !o.paid_at
                  : statusFilter === 'paid'
                    ? o.status === 'served' && !!o.paid_at
                    : statusFilter === 'cancelled'
                      ? o.status === 'cancelled'
                      : true;
      if (!matchTab) return false;
      if (!q) return true;
      const items = itemsByOrder[o.id] || [];
      const hay = [
        o.table_number ? `table ${o.table_number}` : '',
        o.customer_name || '',
        o.server_name || '',
        o.pole_code || '',
        o.id.slice(0, 8),
        o.notes || '',
        ...items.map((i) => i.product_name),
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [orders, statusFilter, searchQuery, itemsByOrder]);

  const itemsByCat = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    const map = new Map<string, MenuItem[]>();
    for (const it of menuItems) {
      if (q && !it.name.toLowerCase().includes(q)) continue;
      const k = it.category_id || '_none';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    }
    return map;
  }, [menuItems, catalogQuery]);

  const filteredCatalogProducts = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q),
    );
  }, [products, catalogQuery]);

  if (loading) {
    return <div className="p-6 text-stone-500 text-center text-sm">Préparation des commandes…</div>;
  }

  if (!estId) {
    return (
      <EmptyState
        icon={<Receipt size={48} />}
        title="Aucun établissement"
        message="Sélectionnez un établissement pour gérer les commandes."
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-16">
      {/* En-tête */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-stone-100 flex items-center gap-2">
            Commandes & Service
            {pendingCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full bg-red-600 text-white text-xs font-bold">
                {pendingCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-stone-400">
            Pipeline complet · Encours actif {formatFCFA(boardCounts.activeTotal)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-600 bg-stone-800 px-3 py-2 text-xs font-semibold text-stone-100 hover:bg-stone-700"
          >
            <RefreshCw size={14} />
            Actualiser
          </button>
          <button
            type="button"
            className="btn-primary flex items-center gap-2"
            onClick={() => {
              setAppendOrderId(null);
              setCart([]);
              setModalErr(null);
              setModalOpen(true);
            }}
          >
            <Plus size={18} /> Nouvelle commande
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${
            feedback.ok
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/40 bg-rose-500/10 text-rose-200'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <AlertCircle size={14} /> {feedback.text}
          </span>
          <button type="button" onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* KPIs pipeline */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button
          type="button"
          onClick={() => setStatusFilter('pending')}
          className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-center hover:border-amber-400"
        >
          <p className="text-[10px] uppercase text-amber-200/80">Nouvelles</p>
          <p className="text-xl font-bold text-amber-300">{boardCounts.pending}</p>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('preparing')}
          className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-3 text-center hover:border-sky-400"
        >
          <p className="text-[10px] uppercase text-sky-200/80">En prépa</p>
          <p className="text-xl font-bold text-sky-300">{boardCounts.preparing}</p>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('ready')}
          className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center hover:border-emerald-400"
        >
          <p className="text-[10px] uppercase text-emerald-200/80">Prêtes</p>
          <p className="text-xl font-bold text-emerald-300">{boardCounts.ready}</p>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('unpaid')}
          className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-center hover:border-rose-400"
        >
          <p className="text-[10px] uppercase text-rose-200/80">À encaisser</p>
          <p className="text-xl font-bold text-rose-300">{boardCounts.unpaid}</p>
        </button>
      </div>

      {/* Recherche + filtres */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Table, client, serveur, article ou #N°…"
            className="input-field pl-9 text-sm py-1.5 w-full"
          />
        </div>
        <select
          className="input-field text-sm py-1.5"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
        >
          <option value="open">Actives & À encaisser</option>
          <option value="pending">Nouvelles ({boardCounts.pending})</option>
          <option value="preparing">En préparation ({boardCounts.preparing})</option>
          <option value="ready">Prêtes ({boardCounts.ready})</option>
          <option value="unpaid">Servies non payées ({boardCounts.unpaid})</option>
          <option value="paid">Soldées & payées</option>
          <option value="cancelled">Annulées</option>
          <option value="all">Toutes (historique)</option>
        </select>
        <input
          type="date"
          className="input-field text-sm py-1.5"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        />
        {dateFilter && (
          <button type="button" className="text-xs text-stone-400 hover:text-stone-200" onClick={() => setDateFilter('')}>
            Effacer
          </button>
        )}
      </div>

      {/* Liste des commandes */}
      {filteredOrders.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag size={48} />}
          title="Aucune commande"
          message="Les commandes QR et salle apparaîtront ici."
        />
      ) : (
        <ul className="space-y-3">
          {filteredOrders.map((o) => {
            const items = itemsByOrder[o.id] || [];
            const sla = slaMinutes(o.created_at, nowMs);
            const isPaid = !!o.paid_at;
            const borderCls =
              o.status === 'pending'
                ? 'border-l-amber-500'
                : o.status === 'preparing'
                  ? 'border-l-sky-500'
                  : o.status === 'ready'
                    ? 'border-l-emerald-500'
                    : o.status === 'cancelled'
                      ? 'border-l-rose-500'
                      : 'border-l-stone-500';
            return (
              <li key={o.id} className={`card p-4 space-y-3 border-l-4 ${borderCls}`}>
                {/* Ligne supérieure : #CMD, table, badges paiement & SLA */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <button type="button" className="text-left min-w-0 flex-1" onClick={() => setDetail(o)}>
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-stone-800 text-stone-300">
                        #CMD-{o.id.slice(0, 6).toUpperCase()}
                      </span>
                      {o.pole_code && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          {poleLabel(o.pole_code)}
                        </span>
                      )}
                      {o.source === 'qr_table' && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                          QR Client
                        </span>
                      )}
                      {o.status !== 'cancelled' && !isPaid && (
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${sla.cls}`}>
                          ⏱ {sla.label}
                        </span>
                      )}
                      {isPaid ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/35">
                          Payée · {payChoiceLabel(o.payment_method)}
                        </span>
                      ) : o.status !== 'cancelled' ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/35">
                          À encaisser
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-base text-stone-100">
                        {o.table_number ? `Table ${o.table_number}` : ORDER_TYPE_LABELS[o.order_type] || o.order_type}
                      </span>
                      {clientLabel(o) && (
                        <span className="text-sm font-bold text-amber-300">· 👤 {clientLabel(o)}</span>
                      )}
                    </div>
                    <div className="text-xs text-stone-400 mt-0.5">
                      {formatTime(o.created_at)}
                      {o.server_name ? ` · Serveur : ${o.server_name}` : ' · Serveur non assigné'}
                    </div>
                  </button>

                  <div className="text-right shrink-0 space-y-1">
                    <div className="text-lg font-extrabold text-amber-400">
                      {formatFCFA(Number(o.total) || 0)}
                    </div>
                    <Badge>{ORDER_STATUS_LABELS[o.status] || o.status}</Badge>
                  </div>
                </div>

                {/* Notes cuisine/bar */}
                {o.notes && (
                  <div className="flex items-start gap-1.5 rounded-xl bg-stone-900/70 border border-stone-800 px-2.5 py-1.5 text-xs text-amber-200/90">
                    <StickyNote size={13} className="shrink-0 mt-0.5 text-amber-400" />
                    <span>{o.notes}</span>
                  </div>
                )}

                {/* Articles inline avec miniatures & toggle individuel */}
                {items.length > 0 && (
                  <div className="rounded-xl border border-stone-800 bg-stone-950/40 divide-y divide-stone-800/70">
                    {items.map((it) => {
                      const prod =
                        (it.product_id && productById.get(it.product_id)) ||
                        productByName.get(it.product_name.trim().toLowerCase());
                      const stLabel =
                        it.status === 'served'
                          ? 'Servi'
                          : it.status === 'ready'
                            ? 'Prêt'
                            : it.status === 'preparing' || it.status === 'in_kitchen'
                              ? 'Prépa'
                              : 'Attente';
                      const stCls =
                        it.status === 'served'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : it.status === 'ready'
                            ? 'bg-sky-500/15 text-sky-300'
                            : it.status === 'preparing' || it.status === 'in_kitchen'
                              ? 'bg-amber-500/15 text-amber-300'
                              : 'bg-stone-800 text-stone-400';
                      return (
                        <div key={it.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <ProductThumb
                              name={it.product_name}
                              category={prod?.category}
                              imageUrl={prod?.image_url}
                              size={28}
                            />
                            <span className="font-semibold text-stone-200 truncate">
                              {it.qty}× {it.product_name}
                            </span>
                            {it.notes && <span className="text-stone-400 truncate">({it.notes})</span>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-stone-300 font-medium">
                              {formatFCFA((Number(it.unit_price) || 0) * it.qty)}
                            </span>
                            {o.status !== 'cancelled' && !isPaid && (
                              <button
                                type="button"
                                onClick={() => void cycleItemStatus(it)}
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${stCls} hover:opacity-80`}
                                title="Toucher pour changer l'état de l'article"
                              >
                                {stLabel}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Barre d'actions pro */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {o.status === 'pending' && (
                    <button
                      type="button"
                      className="btn-primary text-xs flex items-center gap-1"
                      onClick={() => void sendToKitchen(o.id)}
                    >
                      <UtensilsCrossed size={14} /> Accepter & Préparer
                    </button>
                  )}
                  {o.status === 'preparing' && (
                    <button
                      type="button"
                      className="btn-secondary text-xs flex items-center gap-1"
                      onClick={() => void updateStatus(o.id, 'ready')}
                    >
                      <Clock size={14} /> Marquer prête
                    </button>
                  )}
                  {o.status === 'ready' && (
                    <button
                      type="button"
                      className="btn-secondary text-xs flex items-center gap-1"
                      onClick={() => void updateStatus(o.id, 'served')}
                    >
                      <CheckCircle2 size={14} /> Servie
                    </button>
                  )}
                  {o.status !== 'cancelled' && !isPaid && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 text-xs font-semibold"
                      onClick={() => openPayModal(o)}
                    >
                      <Wallet size={14} /> Encaisser
                    </button>
                  )}
                  {o.status !== 'cancelled' && !isPaid && (
                    <button
                      type="button"
                      className="btn-secondary text-xs flex items-center gap-1"
                      onClick={() => {
                        setAppendOrderId(o.id);
                        setCart([]);
                        setNotes('');
                        setModalErr(null);
                        setModalOpen(true);
                      }}
                    >
                      <Plus size={14} /> + Tour
                    </button>
                  )}
                  {canAssign && o.status !== 'cancelled' && (
                    <button
                      type="button"
                      className="btn-secondary text-xs flex items-center gap-1"
                      onClick={() => setAssignOrderId(assignOrderId === o.id ? null : o.id)}
                    >
                      <UserCog size={14} /> Serveur
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-secondary text-xs flex items-center gap-1"
                    onClick={() => { setReceiptOrder(o); setCopiedReceipt(false); }}
                  >
                    <Receipt size={14} /> Addition
                  </button>
                  {o.status !== 'cancelled' && !isPaid && (
                    <button
                      type="button"
                      className="btn-ghost text-xs text-rose-400 flex items-center gap-1"
                      onClick={() => { setCancelOrder(o); setCancelReason(''); }}
                    >
                      <Ban size={14} /> Annuler
                    </button>
                  )}
                </div>

                {/* Attribution rapide serveur */}
                {assignOrderId === o.id && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-stone-800">
                    <span className="text-[11px] text-stone-400 mr-1">Attribuer à :</span>
                    {servers.map((s) => (
                      <button
                        key={s.user_id}
                        type="button"
                        disabled={assignBusy}
                        className={`text-xs px-2.5 py-1 rounded-lg border ${
                          o.server_id === s.user_id
                            ? 'border-amber-500 bg-amber-500/15 text-amber-200'
                            : 'border-stone-600 text-stone-200 hover:border-amber-500'
                        }`}
                        onClick={() => void assignServer(o, s)}
                      >
                        {s.full_name} {s.on_duty ? '' : '(repos)'}
                      </button>
                    ))}
                    <button type="button" className="text-xs text-stone-400 ml-1" onClick={() => setAssignOrderId(null)}>
                      <X size={14} />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Modal Nouvelle commande / Ajouter un tour */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setAppendOrderId(null); setModalErr(null); }}
        title={appendOrderId ? 'Ajouter un tour à la commande' : 'Nouvelle commande'}
      >
        <div className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
          {modalErr && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {modalErr}
            </div>
          )}

          {!appendOrderId && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="block text-xs text-stone-400">
                Type de service
                <select
                  className="input-field mt-1 w-full"
                  value={orderType}
                  onChange={(e) => setOrderType(e.target.value as typeof orderType)}
                >
                  <option value="dine_in">Sur place</option>
                  <option value="takeaway">À emporter</option>
                  <option value="delivery">Livraison</option>
                </select>
              </label>
              {orderType === 'dine_in' && (
                <label className="block text-xs text-stone-400">
                  Table
                  <select
                    className="input-field mt-1 w-full"
                    value={tableId}
                    onChange={(e) => setTableId(e.target.value)}
                  >
                    <option value="">Comptoir / Sans table</option>
                    {tables.map((tb) => (
                      <option key={tb.id} value={tb.id}>
                        Table {tb.number} ({tb.status === 'occupied' ? 'occupée' : 'libre'})
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block text-xs text-stone-400">
                Nom du client
                <input
                  className="input-field mt-1 w-full"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ex. M. Koné / Table terrasse"
                />
              </label>
              {poles.length > 0 && !lockedPole && (
                <label className="block text-xs text-stone-400">
                  Pôle / Caisse
                  <select
                    className="input-field mt-1 w-full"
                    value={selectedPole}
                    onChange={(e) => setSelectedPole(e.target.value)}
                  >
                    <option value="">Général</option>
                    {poles.map((p) => (
                      <option key={p.code} value={p.code}>{p.name}</option>
                    ))}
                  </select>
                </label>
              )}
              {servers.length > 0 && (
                <label className="block text-xs text-stone-400 sm:col-span-2">
                  Serveur en charge
                  <select
                    className="input-field mt-1 w-full"
                    value={selectedServerId}
                    onChange={(e) => setSelectedServerId(e.target.value)}
                  >
                    <option value="">Moi-même ({member?.fullName || 'Opérateur'})</option>
                    {servers.map((s) => (
                      <option key={s.user_id} value={s.user_id}>
                        {s.full_name} ({s.open_orders} cmd en cours)
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              className={`flex-1 text-sm py-2 rounded-xl border ${catalogTab === 'carte' ? 'border-amber-500 bg-amber-500/10 text-amber-200' : 'border-stone-700 text-stone-400'}`}
              onClick={() => setCatalogTab('carte')}
            >
              Carte ({menuItems.length})
            </button>
            <button
              type="button"
              className={`flex-1 text-sm py-2 rounded-xl border ${catalogTab === 'stock' ? 'border-amber-500 bg-amber-500/10 text-amber-200' : 'border-stone-700 text-stone-400'}`}
              onClick={() => setCatalogTab('stock')}
            >
              Boissons & Stock ({products.length})
            </button>
          </div>

          <input
            type="text"
            className="input-field text-sm py-1.5 w-full"
            value={catalogQuery}
            onChange={(e) => setCatalogQuery(e.target.value)}
            placeholder="Rechercher un plat ou une boisson…"
          />

          {catalogTab === 'carte' ? (
            menuItems.length === 0 ? (
              <p className="text-sm text-stone-500">
                Aucun plat dans la carte. Utilisez l’onglet <strong>Boissons & Stock</strong>.
              </p>
            ) : (
              <div className="space-y-3">
                {categories.map((cat) => {
                  const list = itemsByCat.get(cat.id) || [];
                  if (!list.length) return null;
                  return (
                    <div key={cat.id}>
                      <p className="text-xs font-semibold text-stone-400 mb-1">{cat.name}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {list.map((it) => (
                          <button
                            key={it.id}
                            type="button"
                            className="text-left rounded-xl border border-stone-700 p-2 text-sm hover:border-amber-500"
                            onClick={() => addMenu(it)}
                          >
                            <span className="block truncate font-medium text-stone-100">{it.name}</span>
                            <span className="block text-amber-400 text-xs">{formatFCFA(it.price)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {(itemsByCat.get('_none') || []).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-stone-400 mb-1">Autres</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(itemsByCat.get('_none') || []).map((it) => (
                        <button
                          key={it.id}
                          type="button"
                          className="text-left rounded-xl border border-stone-700 p-2 text-sm hover:border-amber-500"
                          onClick={() => addMenu(it)}
                        >
                          <span className="block truncate font-medium text-stone-100">{it.name}</span>
                          <span className="block text-amber-400 text-xs">{formatFCFA(it.price)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filteredCatalogProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="flex items-center gap-2 text-left rounded-xl border border-stone-700 p-2 text-sm hover:border-amber-500"
                  onClick={() => addProduct(p)}
                >
                  <ProductThumb product={p} size={32} />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-stone-100">{p.name}</span>
                    <span className="block text-amber-400 text-xs">{formatFCFA(p.price)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <label className="block text-xs text-stone-400">
            Instructions cuisine / bar
            <input
              className="input-field mt-1 w-full"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex. Bien glacée, sans piment, service rapide…"
            />
          </label>

          {cart.length > 0 && (
            <div className="space-y-2 border-t border-stone-800 pt-2">
              {cart.map((i) => (
                <div key={lineKey(i)} className="flex justify-between text-sm items-center">
                  <span className="text-stone-200">
                    {lineName(i)} × {i.qty}
                    {i.kind === 'menu' && <span className="text-[10px] text-stone-500 ml-1">carte</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    <button type="button" className="text-rose-400" onClick={() => updateQty(lineKey(i), -1)}>
                      <Trash2 size={14} />
                    </button>
                    <span className="font-semibold text-stone-100">{formatFCFA(linePrice(i) * i.qty)}</span>
                  </span>
                </div>
              ))}
              <p className="font-bold text-amber-300 text-right">Total : {formatFCFA(cartTotal)}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  className="btn-primary w-full"
                  disabled={busy}
                  onClick={() => void createOrder()}
                >
                  {busy ? 'Envoi…' : appendOrderId ? 'Ajouter ce tour à la commande' : 'Créer & envoyer la commande'}
                </button>
                {!appendOrderId && (
                  <button
                    type="button"
                    className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 px-3 text-sm font-bold disabled:opacity-50"
                    disabled={busy}
                    onClick={() => void createOrder('cash')}
                  >
                    Créer & Encaisser (Espèces)
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal options carte */}
      <Modal open={!!optItem} onClose={() => setOptItem(null)} title={optItem ? `Options · ${optItem.name}` : 'Options'}>
        <div className="space-y-3">
          {optList.map((o) => (
            <label key={o.id} className="flex items-center gap-2 text-sm text-stone-200">
              <input
                type="checkbox"
                checked={optSelected.includes(o.id)}
                onChange={(e) => {
                  setOptSelected((prev) =>
                    e.target.checked ? [...prev, o.id] : prev.filter((x) => x !== o.id),
                  );
                }}
              />
              <span className="flex-1">{o.name}</span>
              <span className="text-amber-300">+{formatFCFA(o.price_delta)}</span>
            </label>
          ))}
          <button type="button" className="btn-primary w-full" onClick={confirmMenuOptions}>
            Ajouter au panier
          </button>
        </div>
      </Modal>

      {/* Modal Encaissement & Clôture (avec Scission par article) */}
      {payOrder && (
        <Modal
          open={!!payOrder}
          onClose={() => !payBusy && setPayOrder(null)}
          title={`Encaisser ${payOrder.table_number ? `Table ${payOrder.table_number}` : `#CMD-${payOrder.id.slice(0, 6).toUpperCase()}`}`}
        >
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                className={`flex-1 py-2 rounded-xl border text-xs font-semibold ${!splitMode ? 'border-amber-500 bg-amber-500/15 text-amber-200' : 'border-stone-700 text-stone-400'}`}
                onClick={() => setSplitMode(false)}
              >
                Addition complète
              </button>
              <button
                type="button"
                className={`flex-1 py-2 rounded-xl border text-xs font-semibold ${splitMode ? 'border-amber-500 bg-amber-500/15 text-amber-200' : 'border-stone-700 text-stone-400'}`}
                onClick={() => setSplitMode(true)}
              >
                Scinder par article
              </button>
            </div>

            {splitMode && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-xl border border-stone-800 p-2">
                {(itemsByOrder[payOrder.id] || []).filter((i) => i.status !== 'served').map((it) => (
                  <label key={it.id} className="flex items-center gap-2 text-xs text-stone-200 py-1">
                    <input
                      type="checkbox"
                      checked={splitIds.includes(it.id)}
                      onChange={(e) =>
                        setSplitIds((prev) =>
                          e.target.checked ? [...prev, it.id] : prev.filter((x) => x !== it.id),
                        )
                      }
                    />
                    <span className="flex-1">{it.qty}× {it.product_name}</span>
                    <span className="text-amber-300 font-semibold">{formatFCFA(it.qty * it.unit_price)}</span>
                  </label>
                ))}
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-stone-400 mb-2">Mode de paiement</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PAY_CHOICES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPayChoice(m.id)}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                      payChoice === m.id
                        ? 'border-amber-500 bg-amber-500/15 text-amber-200'
                        : 'border-stone-700 text-stone-300 hover:border-stone-500'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-stone-900 border border-stone-800 p-3">
              <span className="text-xs text-stone-400">Montant à encaisser</span>
              <span className="text-xl font-extrabold text-emerald-400">
                {formatFCFA(
                  splitMode
                    ? (itemsByOrder[payOrder.id] || [])
                        .filter((i) => splitIds.includes(i.id))
                        .reduce((s, i) => s + i.qty * i.unit_price, 0)
                    : Number(payOrder.total) || 0,
                )}
              </span>
            </div>

            <button
              type="button"
              disabled={payBusy || (splitMode && splitIds.length === 0)}
              onClick={() => void confirmCloseAndPay()}
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 text-sm font-bold disabled:opacity-50"
            >
              {payBusy ? 'Encaissement en cours…' : 'Confirmer l’encaissement & clôturer'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal Annulation avec motif */}
      {cancelOrder && (
        <Modal
          open={!!cancelOrder}
          onClose={() => !cancelBusy && setCancelOrder(null)}
          title="Annuler la commande"
        >
          <div className="space-y-3">
            <p className="text-xs text-stone-400">
              Motif obligatoire (enregistré dans le journal d’audit) :
            </p>
            <div className="flex flex-wrap gap-1.5">
              {CANCEL_MOTIFS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setCancelReason(m)}
                  className={`text-xs px-2.5 py-1 rounded-full border ${
                    cancelReason === m
                      ? 'border-rose-500 bg-rose-500/15 text-rose-200'
                      : 'border-stone-700 text-stone-300'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <input
              className="input-field w-full text-sm"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Préciser le motif d'annulation…"
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary text-xs" onClick={() => setCancelOrder(null)}>
                Retour
              </button>
              <button
                type="button"
                disabled={cancelBusy || !cancelReason.trim()}
                onClick={() => void confirmCancel()}
                className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 text-xs font-bold disabled:opacity-50"
              >
                {cancelBusy ? 'Annulation…' : 'Confirmer annulation'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Ticket / Addition imprimable 80mm / A4 */}
      {receiptOrder && (
        <ReceiptPrintModal
          receipt={{
            id: receiptOrder.id,
            kind: (receiptOrder.notes || '').includes('[CHAMBRE]')
              ? 'chambre'
              : (receiptOrder.pole_code || '') === 'cuisine'
                ? 'nourriture'
                : (receiptOrder.pole_code || '') === 'bar'
                  ? 'boisson'
                  : 'mixte',
            establishmentName: activeEstablishment?.name || 'GESMAK',
            establishmentPhone: activeEstablishment?.phone,
            establishmentAddress: activeEstablishment?.address,
            tableOrRoomLabel: receiptOrder.table_number
              ? `Table ${receiptOrder.table_number}`
              : ORDER_TYPE_LABELS[receiptOrder.order_type] || receiptOrder.order_type,
            customerName: clientLabel(receiptOrder),
            serverName: receiptOrder.server_name,
            createdAt: receiptOrder.created_at,
            status: receiptOrder.status,
            paymentMethod: receiptOrder.payment_method,
            paidAmount: receiptOrder.paid_amount ?? (receiptOrder.paid_at ? Number(receiptOrder.total) : 0),
            total: Number(receiptOrder.total) || 0,
            notes: receiptOrder.notes,
            items: (itemsByOrder[receiptOrder.id] || []).map((it) => ({
              name: it.product_name,
              qty: it.qty,
              unitPrice: Number(it.unit_price) || 0,
              note: it.notes,
            })),
          }}
          onClose={() => setReceiptOrder(null)}
        />
      )}

      {/* Modal Détail rapide */}
      {detail && (
        <Modal open={!!detail} onClose={() => setDetail(null)} title={`Détail · #CMD-${detail.id.slice(0, 6).toUpperCase()}`}>
          <div className="space-y-3">
            <p className="text-sm text-stone-300">
              {detail.customer_name && <span>Client : <strong>{detail.customer_name}</strong><br /></span>}
              {detail.table_number && <span>Table : {detail.table_number}<br /></span>}
              {detail.server_name && <span>Serveur : {detail.server_name}<br /></span>}
              Heure : {formatTime(detail.created_at)}
              {detail.source === 'qr_table' ? ' · QR Client' : ''}
            </p>
            <ul className="space-y-1 text-sm">
              {(itemsByOrder[detail.id] || []).map((it) => (
                <li key={it.id} className="flex justify-between text-stone-200">
                  <span>{it.product_name} × {it.qty}</span>
                  <span>{formatFCFA((it.unit_price || 0) * it.qty)}</span>
                </li>
              ))}
            </ul>
            <p className="font-bold text-amber-400 text-right">Total : {formatFCFA(Number(detail.total) || 0)}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {detail.status === 'pending' && (
                <button
                  type="button"
                  className="btn-primary text-xs"
                  onClick={async () => { await sendToKitchen(detail.id); setDetail(null); }}
                >
                  Accepter & Préparer
                </button>
              )}
              {detail.status !== 'cancelled' && !detail.paid_at && (
                <button
                  type="button"
                  className="rounded-xl bg-emerald-600 text-white px-3 py-1.5 text-xs font-semibold"
                  onClick={() => { const d = detail; setDetail(null); openPayModal(d); }}
                >
                  Encaisser
                </button>
              )}
              {detail.status !== 'cancelled' && !detail.paid_at && (
                <button
                  type="button"
                  className="btn-ghost text-xs text-rose-400"
                  onClick={() => { const d = detail; setDetail(null); setCancelOrder(d); setCancelReason(''); }}
                >
                  Annuler
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
