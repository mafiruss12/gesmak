import { useEffect, useState } from 'react';
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Smartphone, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { MOBILE_MONEY_PROVIDERS, MOBILE_MONEY_LABELS, type MobileMoneyProvider } from '@/lib/integrations';
import { useAuth } from '@/lib/auth';
import { getBusinessUI } from '@/lib/businessTypes';
import type { Product, PaymentMethod } from '@/lib/types';
import { Modal, EmptyState } from '@/components/ui';
import { cacheSet, fetchWithCache, isOnline, queueAdd } from '@/lib/offline';
import { createFactureFromCart, loadDayOpsSummary } from '@/lib/opsHub';
import { useEstId } from '@/lib/useEstId';
import { formatFCFA } from '@/lib/format';
import { Link } from 'react-router-dom';

interface CartItem {
  product: Product;
  qty: number;
}

export default function Caisse({ embedded = false }: { embedded?: boolean } = {}) {
  const { member, activeEstablishment } = useAuth();
  const estId = useEstId();
  const ui = getBusinessUI(activeEstablishment?.type);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
              .select('id,establishment_id,name,category,price,cost,stock,min_stock,unit,image_url')
              .eq('establishment_id', estId)
              .order('name');
            list = (res.data ?? []) as Product[];
            if (list.length || !res.error) break;
            await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
          }
          return list;
        });
        if (!cancelled) setProducts(data ?? []);
      } catch (e) {
        console.error('Caisse load', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    const t = window.setTimeout(() => { if (!cancelled) setLoading(false); }, 8000);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [estId]);

  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.qty, 0);

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) => (i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { product, qty: 1 }];
    });
  }

  function updateQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) => (i.product.id === productId ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0)
    );
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  }

  async function processSale() {
    if (!member?.establishment_id || cart.length === 0) return;
    setProcessing(true);
    try {
      const online = isOnline();
      const updatedProducts = [...products];

      for (const item of cart) {
        const salePayload = {
          establishment_id: member.establishment_id,
          product_id: item.product.id,
          qty: item.qty,
          unit_price: item.product.price,
          total: item.product.price * item.qty,
          payment_method: paymentMethod,
          created_by: member.user_id,
        };
        const newStock = Math.max(0, item.product.stock - item.qty);

        if (online) {
          await supabase.from('sales').insert(salePayload);
          const consigne = Number((item.product as Product).consigne_unit) || 0;
          const prevEmpty = Number((item.product as Product).empty_bottles) || 0;
          const productUpdate: Record<string, number> = { stock: newStock };
          if (consigne > 0) {
            productUpdate.empty_bottles = prevEmpty + item.qty;
          }
          await supabase.from('products').update(productUpdate).eq('id', item.product.id);
          try {
            await supabase.from('stock_movements').insert({
              establishment_id: member.establishment_id,
              product_id: item.product.id,
              product_name: item.product.name,
              qty: -item.qty,
              movement_type: 'pos_sale',
              unit_cost: Number(item.product.cost) || 0,
              unit_price: Number(item.product.price) || 0,
              reason: 'caisse',
              note: `Vente caisse ${paymentMethod}`,
              created_by: member.user_id,
            });
          } catch { /* */ }
        } else {
          // Hors ligne : file d'attente + mise à jour locale
          await queueAdd('sales', 'insert', salePayload);
          await queueAdd('products', 'update', { stock: newStock, _prev_stock: Number(item.product.stock) || 0 }, { id: item.product.id });
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
      await cacheSet(`products:${member.establishment_id}`, updatedProducts);

      // Facture liée (option)
      try {
        if (online && cart.length && member?.establishment_id) {
          await createFactureFromCart({
            estId: member.establishment_id,
            lines: cart.map((i) => ({
              label: i.product.name,
              qty: i.qty,
              unit_price: Number(i.product.price) || 0,
            })),
            total: cartTotal,
            paymentMethod: String(paymentMethod),
            userId: member.user_id,
          });
        }
      } catch (e) {
        console.warn('facture auto', e);
      }

      setSuccess(true);
      setCart([]);
      setTimeout(() => {
        setSuccess(false);
        setCheckoutOpen(false);
      }, 2000);
    } finally {
      setProcessing(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-stone-400">Chargement...</div>;

  if (!member?.establishment_id) {
    return <EmptyState icon={<ShoppingCart size={48} />} title="Aucun établissement" message="Vous n'êtes rattaché à aucun établissement." />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-3rem)] lg:h-[calc(100vh-4rem)]">
      {/* Catalogue */}
      <div className="lg:col-span-2 flex flex-col">
        {!embedded && (<h1 className="text-2xl font-bold font-display text-stone-100 mb-4">{ui.posTitle}</h1>)}
      {!embedded && (
      <div className="flex flex-wrap gap-2 text-xs mb-3">
        <Link to="/daily-report" className="px-2 py-1 rounded-lg bg-amber-500/15 text-amber-200 border border-amber-500/30">→ Rapport du jour</Link>
        <Link to="/cloture" className="px-2 py-1 rounded-lg bg-stone-800 text-stone-300 border border-stone-700">→ Clôture Z</Link>
        <Link to="/documents" className="px-2 py-1 rounded-lg bg-stone-800 text-stone-300 border border-stone-700">→ Devis / Factures</Link>
      </div>
      )}
        <div className="relative mb-4">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
          <input
            type="text"
            placeholder={`Rechercher ${ui.productSingular.toLowerCase()}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <EmptyState icon={<ShoppingCart size={48} />} title={ui.productPlural} message={ui.emptyProducts} />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={p.stock <= 0}
                  className="card text-left transition-all hover:border-primary-500/50 hover:bg-stone-800/50 disabled:opacity-40 active:scale-95"
                >
                  <p className="font-medium text-stone-100 truncate">{p.name}</p>
                  <p className="text-sm text-stone-400 mt-1">{p.price.toLocaleString('fr-FR')} FCFA</p>
                  <p className={`text-xs mt-1 ${p.stock <= p.min_stock ? 'text-warning-400' : 'text-stone-500'}`}>
                    Stock: {p.stock} {p.unit}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Panier */}
      <div className="card flex flex-col h-full">
        <h2 className="text-lg font-semibold text-stone-100 mb-3 flex items-center gap-2">
          <ShoppingCart size={20} /> Panier
        </h2>
        <div className="flex-1 overflow-y-auto space-y-2">
          {cart.length === 0 ? (
            <p className="text-sm text-stone-500 text-center py-8">Panier vide</p>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="flex items-center gap-2 bg-stone-800/50 rounded-xl p-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-200 truncate">{item.product.name}</p>
                  <p className="text-xs text-stone-500">{item.product.price.toLocaleString('fr-FR')} FCFA</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(item.product.id, -1)} className="p-1 rounded-lg hover:bg-stone-700 text-stone-300">
                    <Minus size={16} />
                  </button>
                  <span className="w-6 text-center text-sm text-stone-200">{item.qty}</span>
                  <button onClick={() => updateQty(item.product.id, 1)} className="p-1 rounded-lg hover:bg-stone-700 text-stone-300">
                    <Plus size={16} />
                  </button>
                  <button onClick={() => removeFromCart(item.product.id)} className="p-1 rounded-lg hover:bg-error-500/20 text-error-400 ml-1">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="border-t border-stone-800 pt-3 mt-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-stone-400">Total</span>
            <span className="text-2xl font-bold font-display text-primary-400">{cartTotal.toLocaleString('fr-FR')} FCFA</span>
          </div>
          <button
            onClick={() => setCheckoutOpen(true)}
            disabled={cart.length === 0}
            className="btn-primary w-full"
          >
            Encaisser
          </button>
        </div>
      </div>

      {/* Modal de paiement */}
      <Modal open={checkoutOpen} onClose={() => !processing && setCheckoutOpen(false)} title="Encaissement">
        {success ? (
          <div className="flex flex-col items-center py-8">
            <CheckCircle2 size={48} className="text-success-400 mb-3" />
            <p className="text-lg font-semibold text-stone-100">Vente enregistrée !</p>
          </div>
        ) : (
          <>
            <div className="bg-stone-800/50 rounded-xl p-4 mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-stone-400">Articles</span>
                <span className="text-stone-200">{cart.reduce((s, i) => s + i.qty, 0)}</span>
              </div>
              <div className="flex justify-between text-lg">
                <span className="text-stone-400">Total</span>
                <span className="font-bold text-primary-400">{cartTotal.toLocaleString('fr-FR')} FCFA</span>
              </div>
            </div>
            <label className="label">Mode de paiement</label>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {MOBILE_MONEY_PROVIDERS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m as PaymentMethod)}
                  className={`p-2.5 rounded-xl border flex items-center gap-2 justify-center text-sm transition-all ${
                    paymentMethod === m
                      ? 'border-primary-500 bg-primary-500/10 text-primary-300'
                      : 'border-stone-700 text-stone-400'
                  }`}
                >
                  {m === 'cash' || m === 'card' ? <CreditCard size={16} /> : m === 'ardoise' ? <span className="text-base">📒</span> : <Smartphone size={16} />}
                  {MOBILE_MONEY_LABELS[m]}
                </button>
              ))}
            </div>
            <button onClick={processSale} disabled={processing} className="btn-primary w-full flex items-center justify-center gap-2">
              {processing ? <Loader2 className="animate-spin" size={18} /> : null}
              Confirmer la vente
            </button>
          </>
        )}
      </Modal>
    </div>
  );
}
