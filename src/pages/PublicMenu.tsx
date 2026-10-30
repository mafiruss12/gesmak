import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Beer, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatFCFA } from '@/lib/format';
import ProductThumb from '@/components/ProductThumb';

type Est = {
  id: string;
  name: string;
  type: string | null;
  address: string | null;
  phone: string | null;
  logo_url: string | null;
  public_menu: boolean;
};

type Prod = {
  id: string;
  name: string;
  category: string | null;
  price: number;
  stock: number;
  image_url?: string | null;
};

type Kit = {
  id: string;
  name: string;
  description: string | null;
  price: number;
};

export default function PublicMenu() {
  const { estId } = useParams<{ estId: string }>();
  const [est, setEst] = useState<Est | null>(null);
  const [products, setProducts] = useState<Prod[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cat, setCat] = useState('Tous');

  useEffect(() => {
    if (!estId) {
      setLoading(false);
      setError('Lien invalide');
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      let e: Est | null = null;
      const looksUuid = /^[0-9a-f-]{32,36}$/i.test(estId);
      if (looksUuid) {
        const { data } = await supabase
          .from('establishments')
          .select('id, name, type, address, phone, logo_url, public_menu')
          .eq('id', estId)
          .maybeSingle();
        e = data as Est | null;
      }
      if (!e) {
        const { data } = await supabase
          .from('establishments')
          .select('id, name, type, address, phone, logo_url, public_menu')
          .eq('slug', estId)
          .maybeSingle();
        e = data as Est | null;
      }
      if (cancelled) return;
      if (!e) {
        setError('Établissement introuvable ou menu non public.');
        setLoading(false);
        return;
      }
      if (!(e as Est).public_menu) {
        setError('Le menu public n’est pas activé pour cet établissement.');
        setEst(e as Est);
        setLoading(false);
        return;
      }
      setEst(e as Est);
      const resolvedId = e.id;
      const [pRes, kRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, category, price, stock, image_url')
          .eq('establishment_id', resolvedId)
          .order('category')
          .order('name'),
        supabase
          .from('product_kits')
          .select('id, name, description, price')
          .eq('establishment_id', resolvedId)
          .eq('active', true)
          .order('name'),
      ]);
      if (cancelled) return;
      setProducts((pRes.data || []) as Prod[]);
      setKits((kRes.data || []) as Kit[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [estId]);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category || 'Autre'));
    return ['Tous', ...Array.from(set).sort()];
  }, [products]);

  const filtered = useMemo(() => {
    if (cat === 'Tous') return products;
    return products.filter((p) => (p.category || 'Autre') === cat);
  }, [products, cat]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center text-stone-400 gap-2">
        <Loader2 className="animate-spin" size={22} /> Chargement du menu…
      </div>
    );
  }

  if (error && !est?.public_menu) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <Beer size={40} className="mx-auto text-amber-500 mb-3" />
          <h1 className="text-lg font-bold text-stone-100 mb-2">Menu indisponible</h1>
          <p className="text-sm text-stone-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 pb-12">
      <header className="sticky top-0 z-10 border-b border-stone-800 bg-stone-950/95 backdrop-blur px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          {est?.logo_url ? (
            <img src={est.logo_url} alt="" className="h-12 w-12 rounded-xl object-cover border border-stone-700" />
          ) : (
            <span className="h-12 w-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Beer size={24} />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-lg font-bold truncate">{est?.name || 'Menu'}</h1>
            {est?.address && <p className="text-xs text-stone-500 truncate">{est.address}</p>}
            {est?.phone && <p className="text-xs text-amber-400/90">{est.phone}</p>}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4">
        {kits.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-400 mb-3 flex items-center gap-1.5">
              <Package size={14} /> Kits & packs
            </h2>
            <ul className="space-y-2">
              {kits.map((k) => (
                <li
                  key={k.id}
                  className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex justify-between gap-3"
                >
                  <div>
                    <p className="font-semibold">{k.name}</p>
                    {k.description && <p className="text-xs text-stone-400 mt-0.5">{k.description}</p>}
                  </div>
                  <p className="font-bold text-amber-300 shrink-0">{formatFCFA(k.price)}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex gap-2 overflow-x-auto pb-3 mb-3 -mx-1 px-1 scrollbar-none">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold border ${
                cat === c
                  ? 'border-amber-500 bg-amber-500/20 text-amber-200'
                  : 'border-stone-700 text-stone-400'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="text-center text-stone-500 py-12 text-sm">Aucun produit pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-2xl border border-stone-800 bg-stone-900/50 px-3 py-2.5"
              >
                <ProductThumb name={p.name} category={p.category} imageUrl={p.image_url} size={44} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{p.name}</p>
                  <p className="text-xs text-stone-500">{p.category || '—'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-amber-300">{formatFCFA(Number(p.price) || 0)}</p>
                  {Number(p.stock) <= 0 && (
                    <p className="text-[10px] text-red-400">Épuisé</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="text-center text-[11px] text-stone-600 mt-10">
          Menu propulsé par GESMAK
        </p>
      </main>
    </div>
  );
}
