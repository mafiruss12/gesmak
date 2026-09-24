import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Beer, Minus, Plus, ShoppingCart, Trash2, CheckCircle2, Loader2,
  Wallet, Smartphone, AlertTriangle, Send, Lock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useEstId } from '@/lib/useEstId';
import type { Product } from '@/lib/types';
import { formatFCFA } from '@/lib/format';
import ProductThumb from '@/components/ProductThumb';
import { isOnline, queueAdd, cacheGet, cacheSet } from '@/lib/offline';
import { notifyOwnerOnReport } from '@/lib/notifyOwner';
import { buildWhatsAppLink } from '@/lib/businessTypes';
import {
  loadLiveDay,
  saveLiveDay,
  addTicket,
  voidTicket,
  aggregateDay,
  markClosed,
  verifyDayHeuristics,
  type LivePayMethod,
  type LiveDayState,
  type LiveSaleLine,
} from '@/lib/liveDaySales';

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

type Phase = 'sell' | 'close' | 'done';

export default function LiveDaySales() {
  const { member, activeEstablishment } = useAuth();
  const estId = useEstId();
  const [date] = useState(todayISO);
  const [products, setProducts] = useState<Product[]>([]);
  const [day, setDay] = useState<LiveDayState | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [pay, setPay] = useState<LivePayMethod>('cash');
  const [phase, setPhase] = useState<Phase>('sell');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [aiTips, setAiTips] = useState<string[]>([]);
  const [cashConfirm, setCashConfirm] = useState('');
  const [mobileConfirm, setMobileConfirm] = useState('');

  useEffect(() => {
    document.title = 'Ventes journée · Stock Manager';
  }, []);

  useEffect(() => {
    if (!estId) return;
    setDay(loadLiveDay(estId, date));
    let cancelled = false;
    (async () => {
      const cacheKey = `products:${estId}`;
      try {
        if (!isOnline()) {
          const cached = await cacheGet<Product[]>(cacheKey);
          if (!cancelled && cached?.length) setProducts(cached);
          return;
        }
        let list: Product[] = [];
        for (let attempt = 0; attempt < 3; attempt++) {
          const { data, error } = await supabase
            .from('products')
            .select('id,establishment_id,name,category,price,cost,stock,min_stock,unit,image_url,units_per_package,casier_size')
            .eq('establishment_id', estId)
            .order('name');
          if (error) console.warn('LiveDaySales products', error.message);
          list = (data as Product[]) || [];
          if (list.length) break;
          await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
        }
        if (!list.length) {
          const cached = await cacheGet<Product[]>(cacheKey);
          if (cached?.length) list = cached;
        }
        if (!cancelled) {
          setProducts(list);
          if (list.length) await cacheSet(cacheKey, list);
        }
      } catch (e) {
        console.error('LiveDaySales load', e);
        try {
          const cached = await cacheGet<Product[]>(cacheKey);
          if (!cancelled && cached?.length) setProducts(cached);
        } catch { /* */ }
      }
    })();
    return () => { cancelled = true; };
  }, [estId, date]);

  useEffect(() => {
    if (day?.closed_at) setPhase(day.stock_deducted ? 'done' : 'close');
  }, [day?.closed_at, day?.stock_deducted]);

  const cartLines: LiveSaleLine[] = useMemo(() => {
    return products
      .filter((p) => (cart[p.id] || 0) > 0)
      .map((p) => ({
        product_id: p.id,
        name: p.name,
        price: Math.round(Number(p.price) || 0),
        cost: Math.round(Number(p.cost) || 0),
        qty: cart[p.id] || 0,
      }));
  }, [products, cart]);

  const cartTotal = cartLines.reduce((s, l) => s + l.qty * l.price, 0);
  const agg = useMemo(() => (day ? aggregateDay(day) : null), [day]);

  function bump(id: string, delta: number) {
    if (day?.closed_at) return;
    setCart((c) => {
      const n = Math.max(0, (c[id] || 0) + delta);
      const next = { ...c };
      if (n === 0) delete next[id];
      else next[id] = n;
      return next;
    });
  }

  function validateSale() {
    if (!estId || !day || day.closed_at) return;
    if (!cartLines.length) {
      setMsg('Cochez au moins une boisson.');
      return;
    }
    const next = addTicket(estId, date, cartLines, pay);
    setDay({ ...next });
    setCart({});
    setMsg(`Vente enregistrée · ${formatFCFA(cartTotal)} (stock inchangé jusqu’à clôture)`);
    setTimeout(() => setMsg(null), 2500);
  }

  function removeTicket(id: string) {
    if (!estId || day?.closed_at) return;
    if (!confirm('Annuler cette vente ?')) return;
    setDay({ ...voidTicket(estId, date, id) });
  }

  function startClose() {
    if (!day || !estId) return;
    if (!day.tickets.length) {
      setMsg('Aucune vente à clôturer.');
      return;
    }
    const tips = verifyDayHeuristics(day, products);
    setAiTips(tips);
    const a = aggregateDay(day);
    setCashConfirm(String(a.cash));
    setMobileConfirm(String(a.mobile));
    setPhase('close');
  }

  async function finalizeClose() {
    if (!estId || !day || !member) return;
    setBusy(true);
    setMsg(null);
    try {
      const a = aggregateDay(day);
      const items = Object.values(a.byProduct).map((l) => ({
        product_id: l.product_id,
        name: l.name,
        qty: l.qty,
        price: l.price,
        cost: l.cost,
        total: l.qty * l.price,
      }));

      // 1) Décrément stock UNE seule fois à la clôture
      let deducted = Boolean(day.stock_deducted);
      if (!deducted) {
        for (const line of items) {
          const prod = products.find((p) => p.id === line.product_id);
          if (!prod) continue;
          const prev = Math.floor(Number(prod.stock) || 0);
          const next = Math.max(0, prev - line.qty);
          if (!isOnline()) {
            await queueAdd(
              'products',
              'update',
              { stock: next, _prev_stock: prev },
              { id: line.product_id },
            );
          } else {
            const { error } = await supabase
              .from('products')
              .update({ stock: next })
              .eq('id', line.product_id);
            if (error) console.warn('stock', error.message);
          }
        }
        deducted = true;
        setProducts((prev) =>
          prev.map((p) => {
            const line = items.find((i) => i.product_id === p.id);
            if (!line) return p;
            return {
              ...p,
              stock: Math.max(0, Math.floor(Number(p.stock) || 0) - line.qty),
            };
          }),
        );
      }

      const cash = Math.max(0, Math.round(Number(cashConfirm) || 0));
      const mobile = Math.max(0, Math.round(Number(mobileConfirm) || 0));
      const notes = [
        'Mode: ventes au fil de l’eau',
        `Tickets: ${a.ticketCount}`,
        `IA: ${aiTips.join(' | ')}`,
        `Clôturé par: ${member.full_name || member.role}`,
      ].join('\n');

      const row: Record<string, unknown> = {
        establishment_id: estId,
        date,
        report_date: date,
        total_sales: a.total,
        cash,
        mobile_money: mobile,
        notes,
        items: JSON.stringify(items),
        stock_deducted: true,
        sent_at: new Date().toISOString(),
        signature: member.full_name || member.role || 'gerant',
      };

      if (isOnline()) {
        const { data: existing } = await supabase
          .from('daily_reports')
          .select('id')
          .eq('establishment_id', estId)
          .eq('date', date)
          .maybeSingle();
        if (existing?.id) {
          await supabase.from('daily_reports').update(row).eq('id', existing.id);
        } else {
          const { error } = await supabase.from('daily_reports').insert(row);
          if (error) {
            const { stock_deducted: _sd, sent_at: _sa, ...rest } = row;
            await supabase.from('daily_reports').insert(rest);
          }
        }
      } else {
        await queueAdd('daily_reports', 'insert', { ...row, _local_id: `live-${estId}-${date}` });
      }

      const closed = markClosed(estId, date, true);
      setDay({ ...closed });

      // Notification propriétaire
      try {
        await notifyOwnerOnReport({
          establishmentId: estId,
          senderName: member.full_name || 'Équipe',
          senderRole: member.role || 'gerant',
          reportDate: date,
          reportSummary: `${a.ticketCount} vente(s) · CA ${formatFCFA(a.total)} · stock décrémenté à la clôture\n` +
            Object.values(a.byProduct).slice(0, 12).map((l) => `• ${l.name} ×${l.qty}`).join('\n'),
        });
      } catch {
        /* */
      }

      setPhase('done');
      setMsg('Journée clôturée · stock mis à jour · rapport envoyé');
    } catch (e: any) {
      setMsg(e?.message || 'Erreur clôture');
    }
    setBusy(false);
  }

  if (!estId) {
    return <p className="p-6 text-stone-400">Établissement non sélectionné.</p>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-28">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-100 flex items-center gap-2">
            <Beer className="text-amber-400" size={24} /> Ventes du jour
          </h1>
          <p className="text-sm text-stone-400 mt-1">
            Cochez chaque client · le stock ne bouge qu’à la <strong className="text-stone-300">clôture du soir</strong>
          </p>
        </div>
        <Link to="/daily-report" className="text-xs text-amber-400 hover:underline shrink-0">
          Point classique
        </Link>
      </div>

      {agg && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-stone-800 bg-stone-900/80 p-3">
            <p className="text-[10px] text-stone-500 uppercase">CA jour</p>
            <p className="text-lg font-bold text-amber-300">{formatFCFA(agg.total)}</p>
          </div>
          <div className="rounded-xl border border-stone-800 bg-stone-900/80 p-3">
            <p className="text-[10px] text-stone-500 uppercase">Ventes</p>
            <p className="text-lg font-bold text-stone-100">{agg.ticketCount}</p>
          </div>
          <div className="rounded-xl border border-stone-800 bg-stone-900/80 p-3">
            <p className="text-[10px] text-stone-500 uppercase">Statut</p>
            <p className="text-sm font-semibold text-stone-200">
              {day?.closed_at ? 'Clôturé' : 'Ouvert'}
            </p>
          </div>
        </div>
      )}

      {msg && (
        <p className="text-sm rounded-xl border border-stone-700 bg-stone-900 px-3 py-2 text-stone-200">
          {msg}
        </p>
      )}

      {phase === 'sell' && !day?.closed_at && (
        <>
          <div className="rounded-2xl border border-stone-800 bg-stone-900/50 p-3">
            <p className="text-xs text-stone-400 mb-2">Appuyez pour ajouter · stock non décrémenté</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto">
              {products.map((p) => {
                const q = cart[p.id] || 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => bump(p.id, 1)}
                    className={`text-left rounded-xl border p-2 transition ${
                      q > 0 ? 'border-amber-500/50 bg-amber-500/10' : 'border-stone-800 bg-stone-950/50'
                    }`}
                  >
                    <div className="flex gap-2 items-center">
                      <ProductThumb product={p} name={p.name} category={p.category} imageUrl={p.image_url} size={48} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-stone-100 truncate">{p.name}</p>
                        <p className="text-[11px] text-amber-300/90">{formatFCFA(Number(p.price) || 0)}</p>
                      </div>
                    </div>
                    {q > 0 && (
                      <div className="mt-2 flex items-center justify-between gap-1">
                        <span
                          role="button"
                          className="p-1 rounded-lg bg-stone-800"
                          onClick={(e) => {
                            e.stopPropagation();
                            bump(p.id, -1);
                          }}
                        >
                          <Minus size={14} />
                        </span>
                        <span className="font-bold text-amber-300">{q}</span>
                        <span
                          role="button"
                          className="p-1 rounded-lg bg-stone-800"
                          onClick={(e) => {
                            e.stopPropagation();
                            bump(p.id, 1);
                          }}
                        >
                          <Plus size={14} />
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {cartLines.length > 0 && (
            <div className="fixed bottom-16 inset-x-0 z-30 px-3 lg:bottom-4">
              <div className="max-w-3xl mx-auto rounded-2xl border border-amber-500/40 bg-stone-950 shadow-xl p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-stone-300 flex items-center gap-1">
                    <ShoppingCart size={16} /> Panier
                  </span>
                  <span className="font-bold text-amber-300">{formatFCFA(cartTotal)}</span>
                </div>
                <div className="flex gap-1">
                  {(
                    [
                      ['cash', 'Espèces', Wallet],
                      ['mobile', 'Mobile', Smartphone],
                      ['mixed', 'Mixte', Wallet],
                    ] as const
                  ).map(([id, label, Icon]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPay(id)}
                      className={`flex-1 flex items-center justify-center gap-1 text-xs py-2 rounded-lg ${
                        pay === id ? 'bg-amber-500 text-stone-950 font-bold' : 'bg-stone-800 text-stone-300'
                      }`}
                    >
                      <Icon size={14} /> {label}
                    </button>
                  ))}
                </div>
                <button type="button" className="btn-primary w-full min-h-[48px]" onClick={validateSale}>
                  Valider la vente
                </button>
              </div>
            </div>
          )}

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-stone-300">Ventes enregistrées (stock pas encore touché)</h2>
            {!day?.tickets.length ? (
              <p className="text-sm text-stone-500">Aucune vente pour l’instant.</p>
            ) : (
              <ul className="space-y-2">
                {day.tickets.slice(0, 30).map((t) => (
                  <li
                    key={t.id}
                    className="rounded-xl border border-stone-800 bg-stone-900/60 px-3 py-2 flex justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-stone-500">
                        {new Date(t.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} ·{' '}
                        {t.pay === 'cash' ? 'Espèces' : t.pay === 'mobile' ? 'Mobile' : 'Mixte'}
                      </p>
                      <p className="text-sm text-stone-200 truncate">
                        {t.lines.map((l) => `${l.name}×${l.qty}`).join(', ')}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-amber-300 text-sm">{formatFCFA(t.total)}</p>
                      <button
                        type="button"
                        className="text-[10px] text-red-400 mt-1"
                        onClick={() => removeTicket(t.id)}
                      >
                        <Trash2 size={12} className="inline" /> Annuler
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <button
            type="button"
            className="btn-primary w-full min-h-[52px] text-base flex items-center justify-center gap-2"
            onClick={startClose}
          >
            <Lock size={18} /> Clôturer la journée
          </button>
        </>
      )}

      {phase === 'close' && day && agg && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
            <h2 className="font-bold text-stone-100 flex items-center gap-2">
              <CheckCircle2 className="text-amber-400" /> Résumé avant clôture
            </h2>
            <p className="text-sm text-stone-300">
              {agg.ticketCount} vente(s) · CA {formatFCFA(agg.total)}
            </p>
            <ul className="text-sm text-stone-200 space-y-1 max-h-40 overflow-y-auto">
              {Object.values(agg.byProduct).map((l) => (
                <li key={l.product_id} className="flex justify-between gap-2">
                  <span>{l.name} × {l.qty}</span>
                  <span className="font-mono text-amber-300/90">{formatFCFA(l.qty * l.price)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-4 space-y-2">
            <h3 className="font-semibold text-sky-200 flex items-center gap-2">
              <AlertTriangle size={16} /> Vérification (gérant + contrôles auto)
            </h3>
            <ul className="text-sm text-stone-300 space-y-1">
              {aiTips.map((t, i) => (
                <li key={i}>• {t}</li>
              ))}
            </ul>
            <p className="text-xs text-stone-500">
              En validant, le stock sera décrémenté une seule fois selon ce résumé.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-stone-400">
              Espèces comptées
              <input
                className="input-field mt-1"
                inputMode="numeric"
                value={cashConfirm}
                onChange={(e) => setCashConfirm(e.target.value)}
              />
            </label>
            <label className="text-xs text-stone-400">
              Mobile money
              <input
                className="input-field mt-1"
                inputMode="numeric"
                value={mobileConfirm}
                onChange={(e) => setMobileConfirm(e.target.value)}
              />
            </label>
          </div>

          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={() => setPhase('sell')}>
              ← Revenir
            </button>
            <button
              type="button"
              className="btn-primary flex-1 min-h-[48px] flex items-center justify-center gap-2"
              disabled={busy}
              onClick={() => void finalizeClose()}
            >
              {busy ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              Confirmer · décrémenter stock · envoyer
            </button>
          </div>
        </div>
      )}

      {phase === 'done' && day && agg && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center space-y-3">
          <CheckCircle2 className="mx-auto text-emerald-400" size={40} />
          <h2 className="text-xl font-bold text-stone-100">Journée clôturée</h2>
          <p className="text-stone-300">
            {agg.ticketCount} ventes · {formatFCFA(agg.total)}
          </p>
          <p className="text-sm text-stone-400">Stock mis à jour · rapport enregistré</p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Link to="/daily-report" className="btn-secondary">
              Voir rapports
            </Link>
            <a
              className="btn-primary"
              href={buildWhatsAppLink(
                '2250502012011',
                `Clôture ${activeEstablishment?.name || ''} ${date}\nCA ${formatFCFA(agg.total)}\n${agg.ticketCount} ventes\nStock décrémenté à la clôture.`,
              )}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp proprio
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
