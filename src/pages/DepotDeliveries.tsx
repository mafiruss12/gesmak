import { useEffect, useMemo, useState } from 'react';
import { Truck, Plus, CheckCircle2, Navigation, Package } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import {
  listDepotClients,
  listDepotDeliveries,
  createDepotDelivery,
  setDeliveryStatus,
  listDeliveryItems,
  recordDeliveryReturn,
  DELIVERY_STATUS_LABELS,
  type DepotClient,
  type DepotDelivery,
  type DepotDeliveryItem,
} from '@/lib/depot';
import { EmptyState } from '@/components/ui';
import type { Product } from '@/lib/types';

type Line = { product_id: string; product_name: string; qty: string; unit_price: string };

export default function DepotDeliveries() {
  const { activeEstablishment, member } = useAuth();
  const depotId = activeEstablishment?.id || member?.establishment_id || null;
  const [list, setList] = useState<DepotDelivery[]>([]);
  const [clients, setClients] = useState<DepotClient[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [detail, setDetail] = useState<{ delivery: DepotDelivery; items: DepotDeliveryItem[] } | null>(null);
  const [returnEdits, setReturnEdits] = useState<Record<string, { qty_returned: string; qty_broken: string }>>({});
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    client_id: '',
    driver_name: '',
    payment_method: 'cash',
    paid_amount: '',
    note: '',
  });
  const [lines, setLines] = useState<Line[]>([{ product_id: '', product_name: '', qty: '1', unit_price: '0' }]);

  async function load() {
    if (!depotId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [d, c] = await Promise.all([listDepotDeliveries(depotId), listDepotClients(depotId)]);
    setList(d);
    setClients(c);
    const { data } = await supabase
      .from('products')
      .select('id,name,price,cost,stock,unit')
      .eq('establishment_id', depotId)
      .order('name');
    setProducts((data || []) as Product[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depotId]);

  const totalPreview = useMemo(() => {
    return lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_price) || 0), 0);
  }, [lines]);

  function openCreate() {
    setForm({ client_id: clients[0]?.id || '', driver_name: '', payment_method: 'cash', paid_amount: '', note: '' });
    setLines([{ product_id: '', product_name: '', qty: '12', unit_price: '0' }]);
    setModal(true);
  }

  function onPickProduct(idx: number, productId: string) {
    const p = products.find((x) => x.id === productId);
    setLines((prev) =>
      prev.map((l, i) =>
        i === idx
          ? {
              ...l,
              product_id: productId,
              product_name: p?.name || '',
              unit_price: String(p?.cost ?? p?.price ?? 0),
            }
          : l
      )
    );
  }

  async function saveDelivery() {
    if (!depotId || !form.client_id) {
      alert('Choisissez un client');
      return;
    }
    const items = lines
      .filter((l) => l.product_name && Number(l.qty) > 0)
      .map((l) => ({
        product_id: l.product_id || null,
        product_name: l.product_name,
        qty: Number(l.qty) || 0,
        unit_price: Number(l.unit_price) || 0,
        line_total: (Number(l.qty) || 0) * (Number(l.unit_price) || 0),
      }));
    if (!items.length) {
      alert('Ajoutez au moins une ligne produit');
      return;
    }
    setBusy(true);
    const r = await createDepotDelivery({
      depot_id: depotId,
      client_id: form.client_id,
      items,
      payment_method: form.payment_method,
      paid_amount: form.paid_amount === '' ? 0 : Number(form.paid_amount),
      driver_name: form.driver_name || undefined,
      note: form.note || undefined,
      status: 'prepared',
      created_by: member?.user_id || null,
    });
    setBusy(false);
    if (!r.ok) {
      alert(r.error || 'Erreur');
      return;
    }
    setModal(false);
    await load();
  }

  async function openDetail(d: DepotDelivery) {
    const items = await listDeliveryItems(d.id);
    setDetail({ delivery: d, items });
    const edits: Record<string, { qty_returned: string; qty_broken: string }> = {};
    for (const it of items) {
      if (!it.id) continue;
      edits[it.id] = {
        qty_returned: String((it as any).qty_returned ?? 0),
        qty_broken: String((it as any).qty_broken ?? 0),
      };
    }
    setReturnEdits(edits);
  }

  async function saveLineReturns() {
    if (!detail) return;
    setBusy(true);
    const items = detail.items
      .filter((it) => it.id)
      .map((it) => ({
        id: it.id as string,
        qty_returned: Number(returnEdits[it.id!]?.qty_returned) || 0,
        qty_broken: Number(returnEdits[it.id!]?.qty_broken) || 0,
      }));
    let retAmt = 0;
    let brkAmt = 0;
    for (const it of detail.items) {
      if (!it.id) continue;
      const r = Number(returnEdits[it.id]?.qty_returned) || 0;
      const b = Number(returnEdits[it.id]?.qty_broken) || 0;
      retAmt += r * Number(it.unit_price || 0);
      brkAmt += b * Number(it.unit_price || 0);
    }
    await recordDeliveryReturn({
      delivery_id: detail.delivery.id,
      items,
      returned_amount: retAmt,
      breakage_amount: brkAmt,
    });
    setBusy(false);
    alert('Retours / casses enregistrés par ligne');
    await openDetail(detail.delivery);
    await load();
  }


  async function advance(d: DepotDelivery, next: string) {
    if (next === 'delivered' && !confirm('Confirmer la livraison ? Le stock dépôt sera diminué et le maquis lié (si présent) sera crédité.')) {
      return;
    }
    setBusy(true);
    const r = await setDeliveryStatus(d.id, next);
    setBusy(false);
    if (!r.ok) {
      alert(r.error || 'Action impossible');
      return;
    }
    setDetail(null);
    await load();
  }

  function statusColor(s: string) {
    if (s === 'delivered') return 'text-emerald-400 bg-emerald-500/15';
    if (s === 'in_transit') return 'text-sky-300 bg-sky-500/15';
    if (s === 'cancelled') return 'text-red-400 bg-red-500/15';
    if (s === 'prepared') return 'text-amber-300 bg-amber-500/15';
    return 'text-stone-400 bg-stone-800';
  }

  if (!depotId) {
    return <p className="p-4 text-stone-500">Aucun établissement dépôt sélectionné.</p>;
  }

  return (
    <div className="max-w-3xl mx-auto p-4 pb-28 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-stone-100 flex items-center gap-2">
            <Truck className="text-teal-400" size={22} /> Livraisons
          </h1>
          <p className="text-sm text-stone-400">Bons de livraison en temps réel</p>
        </div>
        <button type="button" onClick={openCreate} className="btn-primary flex items-center gap-1.5 text-sm">
          <Plus size={16} /> Nouveau BL
        </button>
      </div>

      {loading ? (
        <p className="text-stone-400 text-sm">Chargement…</p>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Truck size={40} />}
          title="Aucune livraison"
          message="Créez un bon de livraison pour un client maquis / bar."
        />
      ) : (
        <ul className="space-y-2">
          {list.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => void openDetail(d)}
                className="w-full text-left rounded-2xl border border-stone-800 bg-stone-900/50 p-4 hover:border-teal-500/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-stone-100">
                      {(d.depot_clients as { name?: string } | null)?.name || 'Client'}
                    </p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {d.delivery_date || d.created_at?.slice(0, 10)}
                      {d.driver_name ? ` · ${d.driver_name}` : ''}
                    </p>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusColor(d.status)}`}>
                    {DELIVERY_STATUS_LABELS[d.status] || d.status}
                  </span>
                </div>
                <p className="text-sm text-amber-400 mt-2 font-semibold">
                  {Number(d.total_amount || 0).toLocaleString('fr-FR')} F
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-3">
          <div className="w-full max-w-lg rounded-2xl bg-stone-900 border border-stone-700 p-4 space-y-3 max-h-[92vh] overflow-y-auto">
            <h2 className="font-semibold text-stone-100">Nouveau bon de livraison</h2>
            <select
              className="input-field"
              value={form.client_id}
              onChange={(e) => setForm({ ...form, client_id: e.target.value })}
            >
              <option value="">— Client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {!clients.length && (
              <p className="text-xs text-amber-400">Ajoutez d’abord un client dans « Clients dépôt ».</p>
            )}
            <input
              className="input-field"
              placeholder="Livreur"
              value={form.driver_name}
              onChange={(e) => setForm({ ...form, driver_name: e.target.value })}
            />
            <div className="space-y-2">
              <p className="text-xs text-stone-400 font-medium">Lignes produits</p>
              {lines.map((l, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <select
                    className="input-field col-span-6 text-sm"
                    value={l.product_id}
                    onChange={(e) => onPickProduct(idx, e.target.value)}
                  >
                    <option value="">Produit</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (stock {p.stock})
                      </option>
                    ))}
                  </select>
                  <input
                    className="input-field col-span-2 text-sm"
                    type="number"
                    min={1}
                    value={l.qty}
                    onChange={(e) =>
                      setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, qty: e.target.value } : x)))
                    }
                    placeholder="Qté"
                  />
                  <input
                    className="input-field col-span-4 text-sm"
                    type="number"
                    value={l.unit_price}
                    onChange={(e) =>
                      setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, unit_price: e.target.value } : x)))
                    }
                    placeholder="Prix"
                  />
                </div>
              ))}
              <button
                type="button"
                className="text-xs text-teal-400"
                onClick={() => setLines((prev) => [...prev, { product_id: '', product_name: '', qty: '12', unit_price: '0' }])}
              >
                + Ajouter une ligne
              </button>
            </div>
            <div className="flex gap-2">
              <select
                className="input-field flex-1"
                value={form.payment_method}
                onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
              >
                <option value="cash">Cash</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="credit">Crédit</option>
              </select>
              <input
                className="input-field flex-1"
                type="number"
                placeholder="Montant payé"
                value={form.paid_amount}
                onChange={(e) => setForm({ ...form, paid_amount: e.target.value })}
              />
            </div>
            <textarea
              className="input-field min-h-[60px]"
              placeholder="Note"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
            <p className="text-sm text-amber-400 font-semibold">Total : {totalPreview.toLocaleString('fr-FR')} F</p>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost flex-1" onClick={() => setModal(false)} disabled={busy}>
                Annuler
              </button>
              <button type="button" className="btn-primary flex-1" onClick={() => void saveDelivery()} disabled={busy}>
                {busy ? '…' : 'Créer le BL'}
              </button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-3">
          <div className="w-full max-w-md rounded-2xl bg-stone-900 border border-stone-700 p-4 space-y-3 max-h-[90vh] overflow-y-auto">
            <h2 className="font-semibold text-stone-100">
              {(detail.delivery.depot_clients as { name?: string } | null)?.name || 'Livraison'}
            </h2>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusColor(detail.delivery.status)}`}>
              {DELIVERY_STATUS_LABELS[detail.delivery.status] || detail.delivery.status}
            </span>
            <ul className="space-y-2 text-sm">
              {detail.items.map((it, i) => (
                <li key={it.id || i} className="rounded-xl border border-stone-800 p-2 space-y-1">
                  <div className="flex justify-between text-stone-300">
                    <span>
                      {it.product_name} × {it.qty}
                    </span>
                    <span>{Number(it.line_total || 0).toLocaleString('fr-FR')} F</span>
                  </div>
                  {(detail.delivery.status === 'delivered' || detail.delivery.status === 'in_transit') && it.id && (
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[10px] text-stone-500">
                        Retour
                        <input
                          type="number"
                          min={0}
                          className="input-field mt-0.5 text-sm"
                          value={returnEdits[it.id]?.qty_returned ?? '0'}
                          onChange={(e) =>
                            setReturnEdits((prev) => ({
                              ...prev,
                              [it.id!]: {
                                qty_returned: e.target.value,
                                qty_broken: prev[it.id!]?.qty_broken ?? '0',
                              },
                            }))
                          }
                        />
                      </label>
                      <label className="text-[10px] text-stone-500">
                        Casse
                        <input
                          type="number"
                          min={0}
                          className="input-field mt-0.5 text-sm"
                          value={returnEdits[it.id]?.qty_broken ?? '0'}
                          onChange={(e) =>
                            setReturnEdits((prev) => ({
                              ...prev,
                              [it.id!]: {
                                qty_returned: prev[it.id!]?.qty_returned ?? '0',
                                qty_broken: e.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <p className="font-semibold text-amber-400">
              Total {Number(detail.delivery.total_amount || 0).toLocaleString('fr-FR')} F
            </p>
            <div className="flex flex-col gap-2">
              {detail.delivery.status === 'prepared' && (
                <button
                  type="button"
                  disabled={busy}
                  className="btn-secondary flex items-center justify-center gap-2"
                  onClick={() => void advance(detail.delivery, 'in_transit')}
                >
                  <Navigation size={16} /> Marquer en route
                </button>
              )}
              {(detail.delivery.status === 'prepared' || detail.delivery.status === 'in_transit') && (
                <button
                  type="button"
                  disabled={busy}
                  className="btn-primary flex items-center justify-center gap-2"
                  onClick={() => void advance(detail.delivery, 'delivered')}
                >
                  <CheckCircle2 size={16} /> Confirmer livré
                </button>
              )}
              {detail.delivery.status === 'delivered' && (
                <p className="text-xs text-emerald-400 flex items-center gap-1">
                  <Package size={14} /> Stock dépôt mis à jour
                  {detail.delivery.status === 'delivered' ? ' (et maquis lié si configuré)' : ''}
                </p>
              )}
              {(detail.delivery.status === 'delivered' || detail.delivery.status === 'in_transit') && (
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  disabled={busy}
                  onClick={() => void saveLineReturns()}
                >
                  Enregistrer retours / casses (par ligne)
                </button>
              )}
              <button type="button" className="btn-ghost" onClick={() => setDetail(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
