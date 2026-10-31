import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Smartphone, Loader2,
  CheckCircle2, QrCode, Printer,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { MOBILE_MONEY_PROVIDERS, MOBILE_MONEY_LABELS, type MobileMoneyProvider } from '@/lib/integrations';
import { useAuth } from '@/lib/auth';
import { getBusinessUI } from '@/lib/businessTypes';
import type { Product, PaymentMethod } from '@/lib/types';
import { Modal, EmptyState } from '@/components/ui';
import { cacheSet, fetchWithCache, isOnline, queueAdd } from '@/lib/offline';
import { createFactureFromCart } from '@/lib/opsHub';
import { useEstId } from '@/lib/useEstId';
import { formatFCFA } from '@/lib/format';
import { Link } from 'react-router-dom';
import ProductThumb from '@/components/ProductThumb';

interface CartItem {
  product: Product;
  qty: number;
}

type ReadyOrder = {
  id: string;
  table_number?: string | null;
  customer_name?: string | null;
  total?: number | null;
  status: string;
  created_at: string;
};

export default function Caisse({ embedded = false }: { embedded?: boolean } = {}) {
  const { member, activeEstablishment, user } = useAuth();
  const estId = useEstId();
  const ui = getBusinessUI(activeEstablishment?.type);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('Tous');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashPart, setCashPart] = useState('');
  const [mmPart, setMmPart] = useState('');
  const [discount, setDiscount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [lastTicket, setLastTicket] = useState<{
    lines: { name: string; qty: number; total: number }[];
    total: number;
    paid: number;
    method: string;
    at: string;
  } | null>(null);
  const [readyOrders, setReadyOrders] = useState<ReadyOrder[]>([]);
  const [linkedOrderId, setLinkedOrderId] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    if (!estId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const cacheKey = `products:${estId}`;
    try {
      const { data } = await fetchWithCache<Product[]>(cacheKey, async () => {
        let list: Product[] = [];
        for (let attempt = 0; attempt < 3; attempt++) {
          const res = await supabase
            .from('products')
            .select('id,establishment_id,name,category,price,cost,stock,min_stock,unit,image_url,consigne_unit,empty_bottles')
            .eq('establishment_id', estId)
            .order('name');
          list = (res.data ?? []) as Product[];
          if (list.length || !res.error) break;
          await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
        }
        return list;
      });
      setProducts(data ?? []);
    } catch {
      setProducts([]);
    }
    setLoading(false);
  }, [estId]);

  const loadReadyOrders = useCallback(async () => {
    if (!estId) return;
    const { data } = await supabase
      .from('orders')
      .select('id, table_number, customer_name, total, status, created_at')
      .eq('establishment_id', estId)
      .in('status', ['ready', 'pending', 'preparing'])
      .order('created_at', { ascending: false })
      .limit(15);
    setReadyOrders((data as ReadyOrder[]) || []);
  }, [estId]);

  useEffect(() => {
    void loadProducts();
    void loadReadyOrders();
  }, [loadProducts, loadReadyOrders]);

  useEffect(() => {
    if (!estId) return;
    const ch = supabase
      .channel(`caisse-orders-${estId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `establishment_id=eq.${estId}` },
        () => void loadReadyOrders(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [estId, loadReadyOrders]);

  const categories = useMemo(() => {
    const s = new Set(products.map((p) => p.category || 'Autres'));
    return ['Tous', ...Array.from(s).sort()];
  }, [products]);

  const filtered = useMemo(() => {
    let list = products;
    if (cat !== 'Tous') list = list.filter((p) => (p.category || 'Autres') === cat);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
    return list;
  }, [products, cat, search]);

  const cartTotal = cart.reduce((s, i) => s + Number(i.product.price) * i.qty, 0);
  const discountNum = Math.max(0, Math.min(cartTotal, Number(discount) || 0));
  const netTotal = Math.max(0, cartTotal - discountNum);

  function addToCart(p: Product) {
    if (p.stock <= 0) return;
    setCart((prev) => {
      const ex = prev.find((i) => i.product.id === p.id);
      if (ex) {
        if (ex.qty >= p.stock) return prev;
        return prev.map((i) => (i.product.id === p.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { product: p, qty: 1 }];
    });
  }

  function setQty(id: string, qty: number) {
    setCart((prev) => {
      if (qty <= 0) return prev.filter((i) => i.product.id !== id);
      return prev.map((i) => (i.product.id === id ? { ...i, qty } : i));
    });
  }

  async function loadOrderIntoCart(orderId: string) {
    const { data: items } = await supabase
      .from('order_items')
      .select('product_id, product_name, qty, unit_price, name, quantity')
      .eq('order_id', orderId);
    if (!items?.length) return;
    const next: CartItem[] = [];
    for (const it of items as any[]) {
      const pid = it.product_id;
      const qty = Number(it.qty ?? it.quantity) || 1;
      const prod = products.find((p) => p.id === pid);
      if (prod) {
        next.push({ product: prod, qty: Math.min(qty, Math.max(1, prod.stock)) });
      } else {
        // produit hors stock local : ligne factice minimale
        next.push({
          product: {
            id: pid || `tmp-${it.product_name}`,
            establishment_id: estId || '',
            name: it.product_name || it.name || 'Article',
            category: null,
            price: Number(it.unit_price) || 0,
            cost: 0,
            stock: 999,
            min_stock: 0,
            unit: 'u',
          } as Product,
          qty,
        });
      }
    }
    setCart(next);
    setLinkedOrderId(orderId);
  }

  function openCheckout() {
    setCashPart(String(netTotal));
    setMmPart('0');
    setDiscount(discount || '');
    setPaymentMethod('cash');
    setSuccess(false);
    setCheckoutOpen(true);
  }

  async function processSale() {
    if (!estId || !member || !cart.length) return;
    setProcessing(true);
    const online = isOnline();
    const updatedProducts = [...products];
    const method = paymentMethod;
    const lines = cart.map((i) => ({
      name: i.product.name,
      qty: i.qty,
      total: Number(i.product.price) * i.qty,
    }));

    try {
      for (const item of cart) {
        const validPid = item.product.id && !String(item.product.id).startsWith('tmp-');
        const salePayload: Record<string, unknown> = {
          establishment_id: estId,
          qty: item.qty,
          unit_price: item.product.price,
          total: item.product.price * item.qty,
          payment_method: method,
          created_by: member.user_id || user?.id,
        };
        if (validPid) salePayload.product_id = item.product.id;
        const newStock = Math.max(0, Number(item.product.stock) - item.qty);

        if (online) {
          await supabase.from('sales').insert(salePayload);
          if (validPid) {
            const consigne = Number((item.product as Product).consigne_unit) || 0;
            const prevEmpty = Number((item.product as Product).empty_bottles) || 0;
            const productUpdate: Record<string, number> = { stock: newStock };
            if (consigne > 0) productUpdate.empty_bottles = prevEmpty + item.qty;
            await supabase.from('products').update(productUpdate).eq('id', item.product.id);
            try {
              await supabase.from('stock_movements').insert({
                establishment_id: estId,
                product_id: item.product.id,
                product_name: item.product.name,
                qty: -item.qty,
                movement_type: 'pos_sale',
                unit_cost: Number(item.product.cost) || 0,
                unit_price: Number(item.product.price) || 0,
                reason: 'caisse',
                note: `Vente caisse ${method}${discountNum ? ` remise ${discountNum}` : ''}`,
                created_by: member.user_id || user?.id,
              });
            } catch {
              /* */
            }
          }
        } else {
          await queueAdd('sales', 'insert', salePayload);
          if (item.product.id && !String(item.product.id).startsWith('tmp-')) {
            await queueAdd(
              'products',
              'update',
              { stock: newStock, _prev_stock: Number(item.product.stock) || 0 },
              { id: item.product.id },
            );
          }
        }

        const idx = updatedProducts.findIndex((p) => p.id === item.product.id);
        if (idx >= 0) {
          const consigne = Number((item.product as Product).consigne_unit) || 0;
          const prevEmpty = Number((item.product as Product).empty_bottles) || 0;
          updatedProducts[idx] = {
            ...updatedProducts[idx],
            stock: newStock,
            empty_bottles: consigne > 0 ? prevEmpty + item.qty : prevEmpty,
          };
        }
      }

      setProducts(updatedProducts);
      await cacheSet(`products:${estId}`, updatedProducts);

      try {
        if (online && cart.length) {
          await createFactureFromCart({
            estId,
            lines: cart.map((i) => ({
              label: i.product.name,
              qty: i.qty,
              unit_price: Number(i.product.price) || 0,
            })),
            total: netTotal,
            paymentMethod: method,
            userId: member.user_id || user?.id || null,
          });
        }
      } catch {
        /* facture optionnelle */
      }

      if (linkedOrderId && online) {
        await supabase.from('orders').update({ status: 'served' }).eq('id', linkedOrderId);
        setLinkedOrderId(null);
        void loadReadyOrders();
      }

      setLastTicket({
        lines,
        total: netTotal,
        paid: netTotal,
        method: MOBILE_MONEY_LABELS[method as MobileMoneyProvider] || method,
        at: new Date().toLocaleString('fr-FR'),
      });
      setCart([]);
      setDiscount('');
      setSuccess(true);
    } catch (e) {
      console.error(e);
      alert('Encaissement impossible. Réessayez.');
    }
    setProcessing(false);
  }

  function printTicket() {
    if (!lastTicket) return;
    const w = window.open('', '_blank', 'width=360,height=640');
    if (!w) return;
    const rows = lastTicket.lines
      .map((l) => `<tr><td>${l.qty}× ${l.name}</td><td style="text-align:right">${Math.round(l.total).toLocaleString('fr-FR')}</td></tr>`)
      .join('');
    w.document.write(`<!DOCTYPE html><html><head><title>Ticket</title>
      <style>body{font-family:system-ui,sans-serif;padding:16px;color:#111} h1{font-size:16px;margin:0 0 8px}
      table{width:100%;border-collapse:collapse} td{padding:4px 0;font-size:13px;border-bottom:1px dashed #ddd}
      .t{font-size:18px;font-weight:800;margin-top:12px}</style></head><body>
      <h1>${activeEstablishment?.name || 'GESMAK'}</h1>
      <p style="font-size:12px;color:#666">${lastTicket.at} · ${lastTicket.method}</p>
      <table>${rows}</table>
      <p class="t">Total ${Math.round(lastTicket.total).toLocaleString('fr-FR')} FCFA</p>
      <p style="font-size:11px;color:#888">Merci · GESMAK</p>
      <script>window.print()</script></body></html>`);
    w.document.close();
  }

  if (loading) {
    return <div className="p-8 text-center text-stone-400">Chargement caisse…</div>;
  }

  return (
    <div className={`max-w-5xl mx-auto space-y-3 pb-8 ${embedded ? '' : 'px-1'}`}>
      {!embedded && (
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-stone-100 flex items-center gap-2">
              <ShoppingCart className="text-amber-400" /> Caisse
            </h1>
            <p className="text-sm text-stone-400">
              {activeEstablishment?.name || 'Établissement'} · encaissement rapide
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link to="/live-sales" className="px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-200 border border-amber-500/30">
              Ventes journée
            </Link>
            <Link to="/orders" className="px-3 py-1.5 rounded-xl bg-stone-800 text-stone-300 border border-stone-700">
              Commandes
            </Link>
          </div>
        </div>
      )}

      {/* Commandes à encaisser (QR / salle) */}
      {readyOrders.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
          <p className="text-xs font-bold uppercase text-amber-300 flex items-center gap-1">
            <QrCode size={14} /> Commandes à encaisser
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {readyOrders.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => void loadOrderIntoCart(o.id)}
                className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs min-w-[140px] ${
                  linkedOrderId === o.id
                    ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                    : 'border-stone-700 bg-stone-900 text-stone-300'
                }`}
              >
                <p className="font-bold truncate">
                  {o.customer_name || 'Client'} · {o.table_number ? `T.${o.table_number}` : o.status}
                </p>
                <p className="text-amber-300 font-mono mt-0.5">{formatFCFA(Number(o.total) || 0)}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-3">
        {/* Catalogue */}
        <div className="lg:col-span-3 space-y-3">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
            <input
              type="text"
              placeholder={`Rechercher ${ui.productSingular.toLowerCase()}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold ${
                  cat === c ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-stone-400'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <EmptyState icon={<ShoppingCart size={48} />} title={ui.productPlural} message={ui.emptyProducts} />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addToCart(p)}
                  disabled={Number(p.stock) <= 0}
                  className="card text-left p-2 transition hover:border-amber-500/50 disabled:opacity-40 active:scale-95"
                >
                  <div className="aspect-square rounded-xl bg-stone-950 flex items-center justify-center mb-1.5 overflow-hidden">
                    <ProductThumb name={p.name} category={p.category} imageUrl={(p as any).image_url} size={88} />
                  </div>
                  <p className="text-xs font-semibold text-stone-100 truncate">{p.name}</p>
                  <p className="text-sm font-bold text-amber-300">{formatFCFA(Number(p.price) || 0)}</p>
                  <p className={`text-[10px] ${Number(p.stock) <= Number(p.min_stock) ? 'text-warning-400' : 'text-stone-500'}`}>
                    Stock {p.stock}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Panier */}
        <div className="lg:col-span-2 card flex flex-col min-h-[320px]">
          <h2 className="text-lg font-semibold text-stone-100 mb-2 flex items-center gap-2">
            <ShoppingCart size={18} /> Panier
            {linkedOrderId && (
              <span className="text-[10px] font-bold uppercase bg-amber-500/20 text-amber-200 px-2 py-0.5 rounded-full">
                Commande liée
              </span>
            )}
          </h2>
          <div className="flex-1 overflow-y-auto space-y-2 max-h-[50vh]">
            {cart.length === 0 ? (
              <p className="text-sm text-stone-500 text-center py-10">Touchez un produit pour l’ajouter</p>
            ) : (
              cart.map((item) => (
                <div key={item.product.id} className="flex items-center gap-2 bg-stone-800/50 rounded-xl p-2">
                  <ProductThumb
                    name={item.product.name}
                    category={item.product.category}
                    imageUrl={(item.product as any).image_url}
                    size={40}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-200 truncate">{item.product.name}</p>
                    <p className="text-xs text-amber-300/90">
                      {formatFCFA(Number(item.product.price) * item.qty)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" className="p-1.5 rounded-lg bg-stone-700" onClick={() => setQty(item.product.id, item.qty - 1)}>
                      <Minus size={14} />
                    </button>
                    <span className="w-6 text-center text-sm font-bold">{item.qty}</span>
                    <button type="button" className="p-1.5 rounded-lg bg-stone-700" onClick={() => setQty(item.product.id, item.qty + 1)}>
                      <Plus size={14} />
                    </button>
                    <button type="button" className="p-1.5 text-red-400" onClick={() => setQty(item.product.id, 0)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-stone-700 pt-3 mt-2 space-y-2">
            <label className="block text-xs text-stone-400">
              Remise (FCFA)
              <input
                className="input-field mt-1"
                inputMode="numeric"
                value={discount}
                onChange={(e) => setDiscount(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="0"
              />
            </label>
            <div className="flex justify-between text-sm">
              <span className="text-stone-400">Total</span>
              <span className="font-bold text-amber-300 text-lg">{formatFCFA(netTotal)}</span>
            </div>
            <button
              type="button"
              onClick={openCheckout}
              disabled={cart.length === 0}
              className="btn-primary w-full min-h-[48px] text-base font-bold"
            >
              Encaisser
            </button>
          </div>
        </div>
      </div>

      <Modal open={checkoutOpen} onClose={() => !processing && setCheckoutOpen(false)} title="Encaissement">
        {success ? (
          <div className="flex flex-col items-center py-6 space-y-3">
            <CheckCircle2 size={48} className="text-success-400" />
            <p className="text-lg font-semibold text-stone-100">Vente enregistrée</p>
            <p className="text-2xl font-black text-amber-300">{formatFCFA(lastTicket?.total || netTotal)}</p>
            <div className="flex gap-2 w-full">
              <button type="button" className="btn-primary flex-1 flex items-center justify-center gap-2" onClick={printTicket}>
                <Printer size={18} /> Ticket
              </button>
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => {
                  setCheckoutOpen(false);
                  setSuccess(false);
                }}
              >
                OK
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-stone-800/50 rounded-xl p-4 mb-4 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-stone-400">Articles</span>
                <span>{cart.reduce((s, i) => s + i.qty, 0)}</span>
              </div>
              {discountNum > 0 && (
                <div className="flex justify-between text-sm text-emerald-300">
                  <span>Remise</span>
                  <span>− {formatFCFA(discountNum)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold">
                <span className="text-stone-300">À encaisser</span>
                <span className="text-amber-300">{formatFCFA(netTotal)}</span>
              </div>
            </div>
            <label className="label">Mode de paiement</label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {MOBILE_MONEY_PROVIDERS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m as PaymentMethod)}
                  className={`p-2.5 rounded-xl border flex items-center gap-2 justify-center text-sm ${
                    paymentMethod === m
                      ? 'border-amber-500 bg-amber-500/10 text-amber-200'
                      : 'border-stone-700 text-stone-400'
                  }`}
                >
                  {m === 'cash' || m === 'card' ? <CreditCard size={16} /> : <Smartphone size={16} />}
                  {MOBILE_MONEY_LABELS[m]}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-stone-500 mb-3">
              Paiement mixte : indiquez les montants si besoin (info ticket). Le total reste {formatFCFA(netTotal)}.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <label className="text-xs text-stone-400">
                Espèces
                <input className="input-field mt-1" inputMode="numeric" value={cashPart} onChange={(e) => setCashPart(e.target.value)} />
              </label>
              <label className="text-xs text-stone-400">
                Mobile Money
                <input className="input-field mt-1" inputMode="numeric" value={mmPart} onChange={(e) => setMmPart(e.target.value)} />
              </label>
            </div>
            <button
              type="button"
              onClick={() => void processSale()}
              disabled={processing}
              className="btn-primary w-full min-h-[48px] flex items-center justify-center gap-2 font-bold"
            >
              {processing ? <Loader2 className="animate-spin" size={18} /> : null}
              Confirmer · {formatFCFA(netTotal)}
            </button>
          </>
        )}
      </Modal>
    </div>
  );
}
