import { useCallback, useEffect, useState } from 'react';
import { Tag, Plus, Loader2, Check, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { listDepotClients, type DepotClient } from '@/lib/depot';
import { supabase } from '@/lib/supabase';
import { formatFCFA } from '@/lib/format';
import { EmptyState, Modal } from '@/components/ui';

type PriceRow = {
  id: string;
  client_id: string;
  product_id: string | null;
  unit_price: number;
  unit_label: string | null;
  products?: { name?: string } | null;
};

export default function DepotPrices() {
  const { member, activeEstablishment } = useAuth();
  const depotId = activeEstablishment?.id || member?.establishment_id || null;
  const [clients, setClients] = useState<DepotClient[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; price: number }[]>([]);
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ client_id: '', product_id: '', unit_price: '', unit_label: 'carton' });

  const load = useCallback(async () => {
    if (!depotId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const c = await listDepotClients(depotId);
    setClients(c);
    const [pr, px] = await Promise.all([
      supabase.from('products').select('id, name, price').eq('establishment_id', depotId).order('name'),
      supabase
        .from('depot_client_prices')
        .select('*, products(name)')
        .eq('depot_id', depotId)
        .order('created_at', { ascending: false }),
    ]);
    setProducts((pr.data || []) as any);
    setRows((px.data || []) as PriceRow[]);
    setLoading(false);
  }, [depotId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!depotId || !form.client_id || !form.product_id || !form.unit_price) return;
    setBusy(true);
    const { error } = await supabase.from('depot_client_prices').upsert(
      {
        depot_id: depotId,
        client_id: form.client_id,
        product_id: form.product_id,
        unit_price: Number(form.unit_price),
        unit_label: form.unit_label || 'carton',
      },
      { onConflict: 'client_id,product_id' },
    );
    setBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    if (!confirm('Supprimer ce tarif ?')) return;
    await supabase.from('depot_client_prices').delete().eq('id', id);
    await load();
  }

  function clientName(id: string) {
    return clients.find((c) => c.id === id)?.name || '—';
  }

  if (loading) {
    return (
      <div className="flex gap-2 p-6 text-stone-400">
        <Loader2 className="animate-spin" /> Chargement…
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-24 p-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Tag size={22} /> Tarifs négociés
          </h1>
          <p className="text-sm text-stone-500">Prix spécifiques par client / produit</p>
        </div>
        <button type="button" className="btn-primary text-sm" onClick={() => setModal(true)}>
          <Plus size={16} /> Tarif
        </button>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<Tag size={40} />} title="Aucun tarif" message="Définissez des prix négociés pour vos gros clients." />
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="card p-3 flex justify-between gap-2 items-center">
              <div>
                <div className="font-medium">{clientName(r.client_id)}</div>
                <div className="text-sm text-stone-400">
                  {(r.products as any)?.name || r.product_id} · {r.unit_label || 'u'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-amber-400 font-semibold">{formatFCFA(r.unit_price)}</span>
                <button type="button" className="text-red-400 p-1" onClick={() => void remove(r.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Nouveau tarif client">
        <div className="space-y-3">
          <select
            className="input w-full"
            value={form.client_id}
            onChange={(e) => setForm({ ...form, client_id: e.target.value })}
          >
            <option value="">Client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            className="input w-full"
            value={form.product_id}
            onChange={(e) => {
              const p = products.find((x) => x.id === e.target.value);
              setForm({
                ...form,
                product_id: e.target.value,
                unit_price: p ? String(p.price) : form.unit_price,
              });
            }}
          >
            <option value="">Produit</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            className="input w-full"
            type="number"
            placeholder="Prix unitaire"
            value={form.unit_price}
            onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
          />
          <input
            className="input w-full"
            placeholder="Unité (carton, palette…)"
            value={form.unit_label}
            onChange={(e) => setForm({ ...form, unit_label: e.target.value })}
          />
          <button type="button" className="btn-primary w-full" disabled={busy} onClick={() => void save()}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Enregistrer
          </button>
        </div>
      </Modal>
    </div>
  );
}
