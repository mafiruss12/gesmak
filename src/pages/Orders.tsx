import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Receipt, Plus, Trash2, ShoppingBag, CheckCircle2, Clock, UtensilsCrossed, X, UserCog,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Product, RestaurantTable, Order } from '@/lib/types';
import { ORDER_STATUS_LABELS, ORDER_TYPE_LABELS } from '@/lib/types';
import { formatFCFA, formatTime } from '@/lib/format';
import { Modal, EmptyState, Badge } from '@/components/ui';
import {
  loadServerCandidates,
  assignServerToOrder,
  type ServerCandidate,
} from '@/lib/serverDispatch';
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
};

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
  const [searchParams, setSearchParams] = useSearchParams();
  const canAssign = ['super_admin', 'admin', 'owner', 'manager'].includes(
    String(effectiveRole || member?.role || ''),
  );

  const [products, setProducts] = useState<Product[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'open' | 'all' | 'pending' | 'served' | 'cancelled'>('open');
  const [dateFilter, setDateFilter] = useState('');
  const [detail, setDetail] = useState<OrderRow | null>(null);
  const [detailItems, setDetailItems] = useState<{ product_name: string; qty: number; unit_price?: number }[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [catalogTab, setCatalogTab] = useState<'carte' | 'stock'>('carte');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'delivery'>('dine_in');
  const [tableId, setTableId] = useState('');
  const [notes, setNotes] = useState('');
  const [servers, setServers] = useState<ServerCandidate[]>([]);
  const [assignOrderId, setAssignOrderId] = useState<string | null>(null);
  const [assignBusy, setAssignBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [appendOrderId, setAppendOrderId] = useState<string | null>(null);
  const [optItem, setOptItem] = useState<MenuItem | null>(null);
  const [optList, setOptList] = useState<MenuItemOption[]>([]);
  const [optSelected, setOptSelected] = useState<string[]>([]);


  const load = useCallback(async () => {
    if (!estId) {
      setLoading(false);
      return;
    }
    try {
      const [prodRes, tabRes, ordRes, cats, items] = await Promise.all([
        supabase.from('products').select('*').eq('establishment_id', estId).order('name'),
        supabase.from('restaurant_tables').select('*').eq('establishment_id', estId).order('number'),
        (() => {
          let q = supabase
            .from('orders')
            .select('*')
            .eq('establishment_id', estId)
            .order('created_at', { ascending: false })
            .limit(200);
          if (statusFilter === 'open') {
            q = q.in('status', ['pending', 'preparing', 'ready']);
          } else if (statusFilter === 'pending') {
            q = q.eq('status', 'pending');
          } else if (statusFilter === 'served') {
            q = q.in('status', ['served', 'delivered', 'completed']);
          } else if (statusFilter === 'cancelled') {
            q = q.eq('status', 'cancelled');
          }
          if (dateFilter) {
            q = q.gte('created_at', `${dateFilter}T00:00:00`).lte('created_at', `${dateFilter}T23:59:59.999`);
          }
          return q;
        })(),
        listCategories(estId).catch(() => [] as MenuCategory[]),
        listMenuItems(estId).catch(() => [] as MenuItem[]),
      ]);
      setProducts((prodRes.data ?? []) as Product[]);
      setTables((tabRes.data ?? []) as RestaurantTable[]);
      setOrders((ordRes.data ?? []) as OrderRow[]);
      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('establishment_id', estId)
        .eq('status', 'pending');
      setPendingCount(count || 0);
      setCategories(cats);
      setMenuItems(items.filter((i) => i.is_available));
      if (canAssign) {
        const c = await loadServerCandidates(estId);
        setServers(c);
      }
    } finally {
      setLoading(false);
    }
  }, [estId, canAssign, statusFilter, dateFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!estId) return;
    const ch = supabase
      .channel(`orders-live-${estId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `establishment_id=eq.${estId}` },
        () => { void load(); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [estId, load]);

  // Deep-link depuis Tables (double-clic) ou ajout sur commande existante
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

  const cartTotal = useMemo(
    () => cart.reduce((s, i) => s + linePrice(i) * i.qty, 0),
    [cart],
  );

  function addProduct(p: Product) {
    setCart((prev) => {
      const key = `p:${p.id}`;
      const ex = prev.find((i) => lineKey(i) === key);
      if (ex) {
        return prev.map((i) => (lineKey(i) === key ? { ...i, qty: i.qty + 1 } : i));
      }
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
      if (ex) {
        return prev.map((i) => (lineKey(i) === key && i === ex ? { ...i, qty: i.qty + 1 } : i));
      }
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

  async function createOrder() {
    if (!estId || cart.length === 0) return;
    setBusy(true);
    try {
      let orderId = appendOrderId;
      if (orderId) {
        // Ajout sur commande ouverte
        for (const i of cart) {
          if (i.kind === 'product') {
            await supabase.from('order_items').insert({
              order_id: orderId,
              product_id: i.product.id,
              product_name: i.product.name,
              qty: i.qty,
              unit_price: i.product.price,
              status: 'pending',
            });
          } else {
            await supabase.from('order_items').insert({
              order_id: orderId,
              product_id: i.item.linked_product_id || null,
              product_name: i.item.name,
              qty: i.qty,
              unit_price: i.item.price,
              status: 'pending',
              menu_item_id: i.item.id,
              selected_options: i.options || [],
              notes: i.notes || null,
            });
          }
        }
        const { data: items } = await supabase
          .from('order_items')
          .select('qty, unit_price')
          .eq('order_id', orderId);
        const total = (items || []).reduce((s, it) => s + Number(it.qty) * Number(it.unit_price), 0);
        await supabase.from('orders').update({ total, status: 'pending' }).eq('id', orderId);
      } else {
        const table = tables.find((t) => t.id === tableId);
        const { data: order, error } = await supabase
          .from('orders')
          .insert({
            establishment_id: estId,
            table_id: tableId || null,
            table_number: table ? String(table.number) : null,
            status: 'pending',
            order_type: orderType,
            total: cartTotal,
            notes: notes || null,
            source: 'staff',
            created_by: user?.id || null,
          })
          .select('id')
          .maybeSingle();
        if (error || !order?.id) {
          alert(error?.message || 'Création impossible');
          return;
        }
        orderId = order.id;
        for (const i of cart) {
          if (i.kind === 'product') {
            await supabase.from('order_items').insert({
              order_id: order.id,
              product_id: i.product.id,
              product_name: i.product.name,
              qty: i.qty,
              unit_price: i.product.price,
              status: 'pending',
            });
          } else {
            await supabase.from('order_items').insert({
              order_id: order.id,
              product_id: i.item.linked_product_id || null,
              product_name: i.item.name,
              qty: i.qty,
              unit_price: i.item.price,
              status: 'pending',
              menu_item_id: i.item.id,
              selected_options: i.options || [],
              notes: i.notes || null,
            });
          }
        }
        if (tableId) {
          await supabase.from('restaurant_tables').update({ status: 'occupied' }).eq('id', tableId);
        }
      }
      setCart([]);
      setNotes('');
      setTableId('');
      setAppendOrderId(null);
      setModalOpen(false);
      setSearchParams({});
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function openDetail(o: OrderRow) {
    setDetail(o);
    const { data } = await supabase
      .from('order_items')
      .select('product_name, qty, unit_price, name, quantity')
      .eq('order_id', o.id);
    setDetailItems(
      (data || []).map((i: any) => ({
        product_name: i.product_name || i.name || '?',
        qty: Number(i.qty ?? i.quantity) || 0,
        unit_price: Number(i.unit_price) || 0,
      })),
    );
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('orders').update({ status }).eq('id', id);
    void load();
  }

  async function sendToKitchen(id: string) {
    await supabase.from('orders').update({ status: 'preparing' }).eq('id', id);
    await supabase
      .from('order_items')
      .update({ status: 'in_kitchen' })
      .eq('order_id', id)
      .eq('status', 'pending');
    void load();
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
    void load();
  }

  function clientLabel(o: OrderRow) {
    if (o.customer_name) return o.customer_name;
    const n = String(o.notes || '');
    const m = n.match(/Client:\s*([^·]+)/i);
    return m ? m[1].trim() : null;
  }

  const itemsByCat = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const it of menuItems) {
      const k = it.category_id || '_none';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    }
    return map;
  }, [menuItems]);

  if (loading) {
    return <div className="p-8 text-stone-400 text-center">Chargement…</div>;
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
    <div className="max-w-3xl mx-auto space-y-4 pb-16">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-stone-100 flex items-center gap-2">
            Commandes
            {pendingCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full bg-red-600 text-white text-xs font-bold">
                {pendingCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-stone-400">
            {orders.length} affichée(s) · {pendingCount} nouvelle(s)
          </p>
        </div>
        <button
          type="button"
          className="btn-primary flex items-center gap-2"
          onClick={() => {
            setCart([]);
            setModalOpen(true);
          }}
        >
          <Plus size={18} /> Nouvelle commande
        </button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select
          className="input-field text-sm py-1.5"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
        >
          <option value="open">Ouvertes</option>
          <option value="pending">Nouvelles</option>
          <option value="all">Toutes (historique)</option>
          <option value="served">Traitées</option>
          <option value="cancelled">Annulées</option>
        </select>
        <input
          type="date"
          className="input-field text-sm py-1.5"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        />
        {dateFilter && (
          <button type="button" className="text-xs text-stone-400" onClick={() => setDateFilter('')}>
            Effacer date
          </button>
        )}
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag size={48} />}
          title="Aucune commande"
          message="Les commandes QR et salle apparaîtront ici."
        />
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id} className="card p-4 space-y-2">
              <button type="button" className="w-full text-left" onClick={() => void openDetail(o)}>
              <div className="flex justify-between gap-2 items-start">
                <div>
                  <div className="font-semibold text-stone-100">
                    {o.table_number ? `Table ${o.table_number}` : ORDER_TYPE_LABELS[o.order_type] || o.order_type}
                    {clientLabel(o) ? ` · ${clientLabel(o)}` : ''}
                    {o.source === 'qr_table' ? ' · QR' : ''}
                  </div>
                  <div className="text-xs text-stone-500">
                    {formatTime(o.created_at)} · {formatFCFA(Number(o.total) || 0)}
                    {o.server_name ? ` · ${o.server_name}` : ''}
                  </div>
                </div>
                <Badge>{ORDER_STATUS_LABELS[o.status] || o.status}</Badge>
              </div>
              </button>
              <div className="flex flex-wrap gap-2">
                {o.status === 'pending' && (
                  <button
                    type="button"
                    className="btn-primary text-xs flex items-center gap-1"
                    onClick={() => void sendToKitchen(o.id)}
                  >
                    <UtensilsCrossed size={14} /> Envoyer en cuisine
                  </button>
                )}
                {o.status === 'preparing' && (
                  <button
                    type="button"
                    className="btn-secondary text-xs flex items-center gap-1"
                    onClick={() => void updateStatus(o.id, 'ready')}
                  >
                    <Clock size={14} /> Marquer prêt
                  </button>
                )}
                {o.status === 'ready' && (
                  <button
                    type="button"
                    className="btn-secondary text-xs flex items-center gap-1"
                    onClick={() => void updateStatus(o.id, 'served')}
                  >
                    <CheckCircle2 size={14} /> Servi
                  </button>
                )}
                {canAssign && (
                  <button
                    type="button"
                    className="btn-secondary text-xs flex items-center gap-1"
                    onClick={() => setAssignOrderId(o.id)}
                  >
                    <UserCog size={14} /> Serveur
                  </button>
                )}
              </div>
              {assignOrderId === o.id && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {servers.map((s) => (
                    <button
                      key={s.user_id}
                      type="button"
                      disabled={assignBusy}
                      className="text-xs px-2 py-1 rounded-lg border border-stone-600 hover:border-amber-500"
                      onClick={() => void assignServer(o, s)}
                    >
                      {s.full_name}
                    </button>
                  ))}
                  <button type="button" className="text-xs text-stone-500" onClick={() => setAssignOrderId(null)}>
                    <X size={14} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setAppendOrderId(null); }} title={appendOrderId ? "Ajouter à la commande" : "Nouvelle commande"}>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto">
          <label className="block text-xs text-stone-400">
            Type
            <select
              className="input-field mt-1"
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
                className="input-field mt-1"
                value={tableId}
                onChange={(e) => setTableId(e.target.value)}
              >
                <option value="">—</option>
                {tables.map((tb) => (
                  <option key={tb.id} value={tb.id}>
                    Table {tb.number} ({tb.status})
                  </option>
                ))}
              </select>
            </label>
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
              Stock ({products.length})
            </button>
          </div>

          {catalogTab === 'carte' ? (
            menuItems.length === 0 ? (
              <p className="text-sm text-stone-500">
                Aucun plat. Ajoutez-en dans <strong>Carte</strong> (/menu-carte).
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
                            {it.name}
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
                          {it.name}
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
              {products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="text-left rounded-xl border border-stone-700 p-2 text-sm hover:border-amber-500"
                  onClick={() => addProduct(p)}
                >
                  {p.name}
                  <span className="block text-amber-400 text-xs">{formatFCFA(p.price)}</span>
                </button>
              ))}
            </div>
          )}

          <label className="block text-xs text-stone-400">
            Notes
            <input className="input-field mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>

          {cart.length > 0 && (
            <div className="space-y-1 border-t border-stone-800 pt-2">
              {cart.map((i) => (
                <div key={lineKey(i)} className="flex justify-between text-sm items-center">
                  <span>
                    {lineName(i)} × {i.qty}
                    {i.kind === 'menu' ? (
                      <span className="text-[10px] text-stone-500 ml-1">carte</span>
                    ) : null}
                  </span>
                  <span className="flex items-center gap-1">
                    <button type="button" onClick={() => updateQty(lineKey(i), -1)}>
                      <Trash2 size={14} />
                    </button>
                    {formatFCFA(linePrice(i) * i.qty)}
                  </span>
                </div>
              ))}
              <p className="font-bold text-amber-300">Total {formatFCFA(cartTotal)}</p>
              <button
                type="button"
                className="btn-primary w-full"
                disabled={busy}
                onClick={() => void createOrder()}
              >
                {busy ? 'Envoi…' : appendOrderId ? 'Ajouter les plats' : 'Créer la commande'}
              </button>
            </div>
          )}
        </div>
      </Modal>

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

      {detail && (
        <Modal open={!!detail} onClose={() => setDetail(null)} title="Détail commande">
          <div className="space-y-3">
            <p className="text-sm text-stone-300">
              {detail.customer_name && <span>Client : <strong>{detail.customer_name}</strong><br/></span>}
              {detail.table_number && <span>Table : {detail.table_number}<br/></span>}
              Heure : {formatTime(detail.created_at)}
              {detail.source === 'qr_table' ? ' · QR' : ''}
            </p>
            <ul className="space-y-1 text-sm">
              {detailItems.map((it, i) => (
                <li key={i} className="flex justify-between text-stone-200">
                  <span>{it.product_name} × {it.qty}</span>
                  <span>{formatFCFA((it.unit_price || 0) * it.qty)}</span>
                </li>
              ))}
            </ul>
            <p className="font-bold text-amber-400">{formatFCFA(Number(detail.total) || 0)}</p>
            <div className="flex flex-wrap gap-2">
              {detail.status === 'pending' && (
                <button type="button" className="btn-primary text-sm" onClick={async () => { await updateStatus(detail.id, 'preparing'); setDetail(null); }}>
                  En traitement
                </button>
              )}
              {['pending', 'preparing', 'ready'].includes(detail.status) && (
                <button type="button" className="btn-secondary text-sm" onClick={async () => { await updateStatus(detail.id, 'served'); setDetail(null); }}>
                  Marquer traitée
                </button>
              )}
              {detail.status !== 'cancelled' && detail.status !== 'served' && (
                <button type="button" className="btn-ghost text-sm text-red-400" onClick={async () => { await updateStatus(detail.id, 'cancelled'); setDetail(null); }}>
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

