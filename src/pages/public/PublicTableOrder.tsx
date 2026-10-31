import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Loader2, Minus, Plus, Send, CheckCircle2, Beer } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatFCFA } from '@/lib/format';
import ProductThumb from '@/components/ProductThumb';
import {
  estimateWaitMinutes,
  ORDER_STATUS_CLIENT,
} from '@/lib/orderAlerts';
import { triggerOrderPush } from '@/lib/push';

type Est = {
  id: string;
  name: string;
  public_menu?: boolean;
  phone?: string | null;
};

type Prod = {
  id: string;
  name: string;
  category: string | null;
  price: number;
  stock: number;
  image_url?: string | null;
};

export default function PublicTableOrder() {
  const { estId: estParam } = useParams<{ estId: string }>();
  const [params] = useSearchParams();
  const tableNum = (params.get('table') || params.get('t') || '').trim();
  const kioskMode = params.get('kiosk') === '1' || params.get('kiosk') === 'true';
  const [estId, setEstId] = useState<string | null>(null);
  const [welcome, setWelcome] = useState('Bienvenue — passez votre commande');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [est, setEst] = useState<Est | null>(null);
  const [products, setProducts] = useState<Prod[]>([]);
  const [tableId, setTableId] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [clientHistory, setClientHistory] = useState<{ id: string; created_at: string; total: number; status: string }[]>([]);
  const [customerPhone, setCustomerPhone] = useState('');

  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [trackStatus, setTrackStatus] = useState<string>('pending');
  const [trackItems, setTrackItems] = useState<{ product_name: string; qty: number; unit_price: number }[]>([]);
  const [trackTotal, setTrackTotal] = useState(0);
  const [trackCreated, setTrackCreated] = useState<string | null>(null);
  const [pendingAhead, setPendingAhead] = useState(0);
  const [trackServer, setTrackServer] = useState<string | null>(null);
  const [cat, setCat] = useState('Tous');
  const [section, setSection] = useState<'boissons' | 'nourriture'>('boissons');

  useEffect(() => {
    document.title = tableNum
      ? `Commander · Table ${tableNum}`
      : 'Commander · GESMAK';
  }, [tableNum]);

  useEffect(() => {
    if (!kioskMode) return;
    try {
      document.documentElement.requestFullscreen?.();
    } catch { /* */ }
    const block = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', block);
    // wake lock si dispo
    let wake: any = null;
    (async () => {
      try {
        wake = await (navigator as any).wakeLock?.request?.('screen');
      } catch { /* */ }
    })();
    return () => {
      window.removeEventListener('beforeunload', block);
      try { wake?.release?.(); } catch { /* */ }
    };
  }, [kioskMode]);

  useEffect(() => {
    if (!estParam) {
      setError('Lien invalide');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Résolution par UUID ou slug public (QR propre à l'établissement)
      let e: any = null;
      const looksUuid = !!estParam && /^[0-9a-f-]{32,36}$/i.test(estParam);
      if (looksUuid) {
        const { data } = await supabase
          .from('establishments')
          .select('id, name, public_menu, phone, slug, qr_config, logo_url, cover_url')
          .eq('id', estParam)
          .maybeSingle();
        e = data;
      }
      if (!e && estParam) {
        const { data } = await supabase
          .from('establishments')
          .select('id, name, public_menu, phone, slug, qr_config, logo_url, cover_url')
          .eq('slug', estParam)
          .maybeSingle();
        e = data;
      }
      if (cancelled) return;
      if (!e) {
        setError('Établissement introuvable. Vérifiez le QR de cet établissement.');
        setLoading(false);
        return;
      }
      setEstId(e.id);
      setEst(e as Est);
      try {
        const cfg = typeof e.qr_config === 'object' && e.qr_config ? e.qr_config : {};
        if (cfg.welcome) setWelcome(String(cfg.welcome));
        if (e.logo_url || e.cover_url) setLogoUrl(e.logo_url || e.cover_url);
      } catch { /* */ }

      const resolvedId = e.id as string;
      const { data: prods } = await supabase
        .from('products')
        .select('id, name, category, price, stock, image_url')
        .eq('establishment_id', resolvedId)
        .order('name');
      setProducts(((prods as Prod[]) || []).filter((p) => Number(p.price) > 0));

      if (tableNum) {
        const { data: tabs } = await supabase
          .from('restaurant_tables')
          .select('id, number')
          .eq('establishment_id', resolvedId);
        const match = (tabs || []).find(
          (t: any) => String(t.number).toLowerCase() === tableNum.toLowerCase(),
        );
        if (match) setTableId(match.id);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [estParam, tableNum]);

  // Suivi statut commande client
  useEffect(() => {
    if (!lastOrderId || !done) return;
    let cancelled = false;
    async function pull() {
      const { data, error } = await supabase.rpc('get_order_public_status', { p_id: lastOrderId });
      if (cancelled || error || !data) return;
      const row = data as any;
      if (row.status) setTrackStatus(String(row.status));
      if (Array.isArray(row.items) && row.items.length) setTrackItems(row.items);
      if (row.total != null) setTrackTotal(Number(row.total) || 0);
      if (row.created_at) setTrackCreated(String(row.created_at));
      if (row.server_name) setTrackServer(String(row.server_name));
    }
    void pull();
    const t = setInterval(() => void pull(), 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [lastOrderId, done]);


  function isDrinkProduct(p: Prod): boolean {
    const c = `${p.category || ''} ${p.name || ''}`.toLowerCase();
    const keys = [
      'boisson', 'bière', 'biere', 'bierre', 'soft', 'jus', 'eau', 'vin', 'cocktail',
      'alcool', 'soda', 'coca', 'café', 'cafe', 'thé', 'the', 'drink', 'liqueur',
      'whisky', 'gin', 'rhum', 'castel', 'flag', 'bock', 'guinness', 'sucrerie',
    ];
    return keys.some((k) => c.includes(k));
  }

  const sectionProducts = useMemo(() => {
    if (section === 'boissons') return products.filter(isDrinkProduct);
    return products.filter((p) => !isDrinkProduct(p));
  }, [products, section]);

  const categories = useMemo(() => {
    const s = new Set(sectionProducts.map((p) => p.category || 'Autres'));
    return ['Tous', ...Array.from(s).sort()];
  }, [sectionProducts]);

  const visible = useMemo(() => {
    if (cat === 'Tous') return sectionProducts;
    return sectionProducts.filter((p) => (p.category || 'Autres') === cat);
  }, [sectionProducts, cat]);

  const lines = useMemo(() => {
    return products
      .filter((p) => (cart[p.id] || 0) > 0)
      .map((p) => ({
        product: p,
        qty: cart[p.id],
        total: cart[p.id] * Math.round(Number(p.price) || 0),
      }));
  }, [products, cart]);

  const total = lines.reduce((s, l) => s + l.total, 0);

  function bump(id: string, d: number) {
    setCart((c) => {
      const n = Math.max(0, (c[id] || 0) + d);
      const next = { ...c };
      if (n === 0) delete next[id];
      else next[id] = n;
      return next;
    });
  }

  async function loadClientHistory(name: string) {
    if (!estId || name.trim().length < 2) {
      setClientHistory([]);
      return;
    }
    let q = supabase
      .from('orders')
      .select('id, created_at, total, status, customer_name, notes')
      .eq('establishment_id', estId)
      .ilike('customer_name', name.trim())
      .order('created_at', { ascending: false })
      .limit(10);
    const { data } = await q;
    setClientHistory((data as any) || []);
  }

  async function submit() {
    if (!estId || lines.length === 0) return;
    const name = customerName.trim();
    if (name.length < 2) {
      setError('Indiquez votre prénom ou nom (min. 2 caractères) pour que le serveur vous identifie.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const noteParts = [
        tableNum ? `Table ${tableNum}` : null,
        `Client: ${name}`,
        customerPhone.trim() ? `Tél: ${customerPhone.trim()}` : null,
        note.trim() || null,
      ].filter(Boolean);
      const notesCombined = noteParts.join(' · ') || 'Commande QR';

      const { data: order, error: oErr } = await supabase
        .from('orders')
        .insert({
          establishment_id: estId,
          table_id: tableId,
          table_number: tableNum || null,
          status: 'pending',
          order_type: 'dine_in',
          total,
          notes: notesCombined,
          source: 'qr_table',
          customer_name: name,
        })
        .select('id')
        .maybeSingle();

      if (oErr || !order?.id) {
        // fallback sans colonnes optionnelles
        const { data: o2, error: e2 } = await supabase
          .from('orders')
          .insert({
            establishment_id: estId,
            table_id: tableId,
            table_number: tableNum || null,
            status: 'pending',
            order_type: 'dine_in',
            total,
            notes: notesCombined,
          })
          .select('id')
          .maybeSingle();
        if (e2 || !o2?.id) {
          throw new Error(
            e2?.message ||
              oErr?.message ||
              'Commande refusée. Activez les commandes QR (politique Supabase) ou réessayez.',
          );
        }
        for (const l of lines) {
          await supabase.from('order_items').insert({
            order_id: o2.id,
            product_id: l.product.id,
            product_name: l.product.name,
            qty: l.qty,
            unit_price: Math.round(Number(l.product.price) || 0),
            status: 'pending',
          });
        }
        setLastOrderId(o2.id);
        void triggerOrderPush(o2.id, estId);
      } else {
        for (const l of lines) {
          await supabase.from('order_items').insert({
            order_id: order.id,
            product_id: l.product.id,
            product_name: l.product.name,
            qty: l.qty,
            unit_price: Math.round(Number(l.product.price) || 0),
            status: 'pending',
          });
        }
        setLastOrderId(order.id);
        void triggerOrderPush(order.id, estId);
      }

      if (tableId) {
        await supabase.from('restaurant_tables').update({ status: 'occupied' }).eq('id', tableId);
      }

      setTrackItems(
        lines.map((l) => ({
          product_name: l.product.name,
          qty: l.qty,
          unit_price: Math.round(Number(l.product.price) || 0),
        })),
      );
      setTrackTotal(total);
      setTrackStatus('pending');
      setTrackCreated(new Date().toISOString());
      setDone(true);
      setCart({});
      setNote('');
      setCustomerName('');
    } catch (e: any) {
      setError(e?.message || 'Envoi impossible');
    }
    setBusy(false);
  }

  if (!tableNum && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0c0a09] text-stone-200 p-6 text-center">
        <div>
          <Beer className="mx-auto text-amber-400 mb-3" size={36} />
          <p className="font-bold text-lg">Scannez le QR de votre table</p>
          <p className="text-sm text-stone-400 mt-2">Le lien doit contenir le numéro de table.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0c0a09] text-stone-400">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (error && !est) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0c0a09] text-stone-300 p-6 text-center">
        {error}
      </div>
    );
  }

  if (done) {
    const waitMin = estimateWaitMinutes(trackStatus, pendingAhead);
    const steps = ['pending', 'preparing', 'ready', 'served'] as const;
    const stepIdx = Math.max(0, steps.indexOf(trackStatus as any));
    return (
      <div className="min-h-screen bg-[#0c0a09] text-stone-100 px-4 py-6 pb-24">
        <div className="max-w-lg mx-auto space-y-4">
          <div className="text-center space-y-2">
            <CheckCircle2 className="text-emerald-400 mx-auto" size={48} />
            <h1 className="text-xl font-bold">Commande reçue</h1>
            <p className="text-stone-400 text-sm">
              {tableNum ? `Table ${tableNum}` : 'Votre commande'} · {est?.name}
            </p>
          </div>

          {trackServer && (
            <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-3 text-center">
              <p className="text-xs text-sky-200/90">Votre serveur / serveuse</p>
              <p className="text-lg font-bold text-stone-100 mt-1">👤 {trackServer}</p>
            </div>
          )}

          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-center">
            <p className="text-xs text-amber-200/90 uppercase tracking-wide">Délai estimé</p>
            <p className="text-4xl font-black text-amber-300 my-1">
              {trackStatus === 'served' ? '0' : `~${waitMin}`}
              <span className="text-lg font-bold"> min</span>
            </p>
            <p className="text-sm font-semibold text-stone-100">
              {ORDER_STATUS_CLIENT[trackStatus] || trackStatus}
            </p>
          </div>

          <div className="flex justify-between gap-1">
            {steps.map((s, i) => (
              <div key={s} className="flex-1 text-center">
                <div
                  className={`h-2 rounded-full mb-1 ${
                    i <= stepIdx ? 'bg-amber-500' : 'bg-stone-800'
                  }`}
                />
                <p className="text-[9px] text-stone-500 leading-tight">
                  {s === 'pending' ? 'Reçue' : s === 'preparing' ? 'Prep.' : s === 'ready' ? 'Prête' : 'Servie'}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-stone-800 bg-stone-900/80 p-4 space-y-2">
            <p className="text-xs text-stone-500 uppercase font-semibold">Votre panier</p>
            {trackItems.map((it, i) => (
              <div key={i} className="flex justify-between gap-2 text-sm">
                <span className="text-stone-200">
                  <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 rounded-lg bg-amber-500/20 text-amber-300 font-bold text-xs mr-1">
                    {it.qty}
                  </span>
                  {it.product_name}
                </span>
                <span className="font-mono text-amber-300/90 shrink-0">
                  {formatFCFA(it.qty * Number(it.unit_price || 0))}
                </span>
              </div>
            ))}
            <div className="border-t border-stone-700 pt-2 flex justify-between font-bold">
              <span>Total</span>
              <span className="text-amber-300">{formatFCFA(trackTotal)}</span>
            </div>
          </div>

          {(customerName.trim() || trackServer) && (
            <p className="text-center text-sm text-stone-300">
              {customerName.trim() ? (
                <>Client : <strong className="text-amber-300">{customerName.trim()}</strong></>
              ) : null}
              {customerName.trim() && trackServer ? ' · ' : null}
              {trackServer ? (
                <>Serveur : <strong className="text-emerald-300">{trackServer}</strong></>
              ) : null}
            </p>
          )}
          <p className="text-center text-xs text-stone-500">
            Le statut se met à jour automatiquement. Paiement au serveur.
          </p>

          {trackStatus === 'served' || !kioskMode ? (
            <button
              type="button"
              className="w-full min-h-[52px] rounded-2xl bg-amber-500 text-stone-950 font-bold text-lg"
              onClick={() => {
                setDone(false);
                setLastOrderId(null);
              }}
            >
              + Nouvelle commande
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-stone-100 pb-36 relative overflow-hidden" style={{ background: 'radial-gradient(ellipse at top, #1c1917 0%, #0c0a09 55%, #0a0a0a 100%)' }}>
      <style>{`
        @keyframes floaty { 0%,100%{ transform: translateY(0);} 50%{ transform: translateY(-6px);} }
        @keyframes shimmer { 0%{ background-position: 0% 50%; } 100%{ background-position: 100% 50%; } }
        @keyframes popin { from{ opacity:0; transform: scale(.92) translateY(8px);} to{ opacity:1; transform: scale(1) translateY(0);} }
        .gesmak-float { animation: floaty 3.2s ease-in-out infinite; }
        .gesmak-pop { animation: popin .45s ease-out both; }
        .gesmak-shimmer {
          background: linear-gradient(90deg, #f59e0b, #fbbf24, #f97316, #f59e0b);
          background-size: 200% 100%;
          animation: shimmer 2.8s linear infinite;
        }
      `}</style>
      <div className="pointer-events-none absolute -top-20 -right-16 w-56 h-56 rounded-full bg-amber-500/15 blur-3xl" />
      <div className="pointer-events-none absolute top-40 -left-20 w-48 h-48 rounded-full bg-orange-600/10 blur-3xl" />

      <header className="sticky top-0 z-10 border-b border-amber-500/20 bg-[#0c0a09]/85 backdrop-blur-md px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="gesmak-float rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 p-2 shadow-lg shadow-amber-900/40">
            <Beer className="text-stone-950" size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-black truncate text-lg tracking-tight">{est?.name || 'Menu'}</h1>
            <p className="text-xs text-amber-200/80 font-medium">
              {tableNum ? `Table ${tableNum}` : 'Commande'} · scan & commandez
            </p>
          </div>
          {logoUrl && (
            <img src={logoUrl} alt="" className="w-11 h-11 rounded-xl object-cover ring-2 ring-amber-400/40" />
          )}
        </div>
      </header>

      <div className="max-w-lg mx-auto px-3 pt-3 space-y-3">
        {!tableNum && (
          <p className="text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 gesmak-pop">
            Astuce : le QR de table contient le numéro (ex. table=5).
          </p>
        )}
        {error && (
          <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        {/* Nom client EN HAUT */}
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/15 to-orange-600/10 p-3 space-y-2 gesmak-pop shadow-lg shadow-amber-950/20">
          <label className="block text-xs font-bold uppercase tracking-wide text-amber-200/90">
            Votre prénom / nom <span className="text-amber-400">(affiché en cuisine)</span>
          </label>
          <input
            className="w-full rounded-xl bg-stone-950/80 border border-amber-500/40 px-3 py-3 text-base font-semibold text-stone-50 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
            placeholder="Ex. Kouassi, Awa…"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            onBlur={() => void loadClientHistory(customerName)}
            maxLength={60}
            autoComplete="name"
          />
          <input
            className="w-full rounded-xl bg-stone-950/60 border border-stone-700 px-3 py-2 text-sm text-stone-200 placeholder:text-stone-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            placeholder="Téléphone (optionnel)"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            inputMode="tel"
          />
        </div>

        {(welcome) && (
          <p className="text-center text-sm text-stone-300/90 italic px-2">{welcome}</p>
        )}

        {/* Deux côtés : Boissons | Nourriture */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-stone-900/80 border border-stone-700/80">
          <button
            type="button"
            onClick={() => { setSection('boissons'); setCat('Tous'); }}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition ${
              section === 'boissons'
                ? 'gesmak-shimmer text-stone-950 shadow-md'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Beer size={18} /> Boissons
          </button>
          <button
            type="button"
            onClick={() => { setSection('nourriture'); setCat('Tous'); }}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition ${
              section === 'nourriture'
                ? 'bg-emerald-500 text-stone-950 shadow-md'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <UtensilsCrossed size={18} /> Nourriture
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                cat === c ? 'bg-amber-500 text-stone-950 scale-105' : 'bg-stone-800/90 text-stone-300'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <p className="text-center text-xs text-stone-500 flex items-center justify-center gap-1">
          <Sparkles size={12} className="text-amber-400" />
          Touchez l&apos;image pour ajouter · {section === 'boissons' ? 'boissons' : 'plats & grillades'}
        </p>
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-700 p-8 text-center text-stone-500 text-sm">
            Aucun article dans « {section === 'boissons' ? 'Boissons' : 'Nourriture'} » pour l&apos;instant.
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          {visible.map((p) => {
            const q = cart[p.id] || 0;
            const soldOut = Number(p.stock) <= 0;
            return (
              <button
                key={p.id}
                type="button"
                disabled={soldOut}
                onClick={() => !soldOut && bump(p.id, 1)}
                className={`relative text-left rounded-2xl border overflow-hidden transition active:scale-[0.97] gesmak-pop ${
                  q > 0
                    ? 'border-amber-400 ring-2 ring-amber-400/40 bg-amber-500/10'
                    : 'border-stone-800 bg-stone-900/80'
                } ${soldOut ? 'opacity-45 grayscale' : ''}`}
              >
                <div className="aspect-square w-full bg-stone-950 flex items-center justify-center p-3">
                  <ProductThumb
                    name={p.name}
                    category={p.category}
                    imageUrl={p.image_url}
                    size={120}
                  />
                </div>
                {q > 0 && (
                  <span className="absolute top-2 right-2 min-w-[28px] h-7 px-1.5 rounded-full bg-amber-500 text-stone-950 text-sm font-black flex items-center justify-center shadow-lg">
                    {q}
                  </span>
                )}
                {soldOut && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-xs font-bold">
                    Épuisé
                  </span>
                )}
                <div className="px-2 py-2 border-t border-stone-800/80">
                  <p className="text-base font-black text-amber-300 leading-none">
                    {formatFCFA(Number(p.price) || 0)}
                  </p>
                  {/* Nom en petit pour ceux qui lisent — l’image reste principale */}
                  <p className="text-[10px] text-stone-500 truncate mt-1 leading-tight">{p.name}</p>
                </div>
                {!soldOut && (
                  <div
                    className="flex items-center justify-between gap-1 px-2 pb-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span
                      role="button"
                      className="flex-1 min-h-[40px] rounded-xl bg-stone-800 flex items-center justify-center"
                      onClick={() => bump(p.id, -1)}
                    >
                      <Minus size={18} />
                    </span>
                    <span
                      role="button"
                      className="flex-1 min-h-[40px] rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-bold"
                      onClick={() => bump(p.id, 1)}
                    >
                      <Plus size={18} />
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {clientHistory.length > 0 && (
          <div className="rounded-xl border border-stone-700 bg-stone-900/80 p-3 text-xs space-y-1 gesmak-pop">
            <p className="text-stone-400 font-medium">Commandes précédentes (même nom)</p>
            {clientHistory.map((h) => (
              <div key={h.id} className="flex justify-between text-stone-300">
                <span>{new Date(h.created_at).toLocaleString('fr-FR')}</span>
                <span>
                  {Math.round(Number(h.total) || 0)} F · {h.status}
                </span>
              </div>
            ))}
          </div>
        )}
        <label className="block text-xs text-stone-400">
          Note (optionnel)
          <input
            className="mt-1 w-full rounded-xl border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-100"
            placeholder="Sans glaçon, etc."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </div>

      {lines.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 border-t border-stone-800 bg-[#0c0a09]/95 backdrop-blur p-3">
          <div className="max-w-lg mx-auto space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-stone-400">{lines.reduce((s, l) => s + l.qty, 0)} article(s)</span>
              <span className="font-bold text-amber-300">{formatFCFA(total)}</span>
            </div>
            <button
              type="button"
              disabled={busy || customerName.trim().length < 2}
              onClick={() => void submit()}
              className="w-full min-h-[52px] rounded-2xl gesmak-shimmer text-stone-950 font-black text-base flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-amber-900/30"
            >
              {busy ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              Envoyer la commande
            </button>
            {customerName.trim().length < 2 && (
              <p className="text-[10px] text-center text-amber-400/90">
                Saisissez votre nom ci-dessus pour envoyer
              </p>
            )}
            <p className="text-[10px] text-center text-stone-500">
              Touchez les images · paiement au serveur
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
