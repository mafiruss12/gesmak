import { useCallback, useEffect, useState } from 'react';
import { Package, Plus, Loader2, Check } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { listDepotClients, type DepotClient } from '@/lib/depot';
import { supabase } from '@/lib/supabase';
import { EmptyState, Modal } from '@/components/ui';

type Consigne = {
  id: string;
  client_id: string;
  product_name: string | null;
  qty_loaned: number;
  qty_returned: number;
};

export default function DepotConsignes() {
  const { member, activeEstablishment } = useAuth();
  const depotId = activeEstablishment?.id || member?.establishment_id || null;
  const [clients, setClients] = useState<DepotClient[]>([]);
  const [rows, setRows] = useState<Consigne[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ client_id: '', product_name: '', qty_loaned: '1', qty_returned: '0' });

  const load = useCallback(async () => {
    if (!depotId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const c = await listDepotClients(depotId);
    setClients(c);
    const { data } = await supabase
      .from('depot_client_consignes')
      .select('*')
      .eq('depot_id', depotId)
      .order('updated_at', { ascending: false });
    setRows((data || []) as Consigne[]);
    setLoading(false);
  }, [depotId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!depotId || !form.client_id || !form.product_name.trim()) return;
    setBusy(true);
    const { error } = await supabase.from('depot_client_consignes').insert({
      depot_id: depotId,
      client_id: form.client_id,
      product_name: form.product_name.trim(),
      qty_loaned: Number(form.qty_loaned) || 0,
      qty_returned: Number(form.qty_returned) || 0,
    });
    setBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    setModal(false);
    await load();
  }

  function clientName(id: string) {
    return clients.find((c) => c.id === id)?.name || id.slice(0, 8);
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
            <Package size={22} /> Consignes clients
          </h1>
          <p className="text-sm text-stone-500">Casiers / bouteilles prêtés vs récupérés</p>
        </div>
        <button type="button" className="btn-primary text-sm" onClick={() => setModal(true)}>
          <Plus size={16} /> Ajouter
        </button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Package size={40} />}
          title="Aucune consigne"
          message="Enregistrez les casiers ou bouteilles prêtés à vos clients."
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const solde = Number(r.qty_loaned) - Number(r.qty_returned);
            return (
              <li key={r.id} className="card p-3 flex justify-between gap-2">
                <div>
                  <div className="font-medium">{clientName(r.client_id)}</div>
                  <div className="text-sm text-stone-400">{r.product_name}</div>
                  <div className="text-xs text-stone-500">
                    Prêté {r.qty_loaned} · Rendu {r.qty_returned}
                  </div>
                </div>
                <div className={`text-sm font-semibold ${solde > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  Solde {solde}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Nouvelle consigne">
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
          <input
            className="input w-full"
            placeholder="Ex. Casier 12, Bouteille vide…"
            value={form.product_name}
            onChange={(e) => setForm({ ...form, product_name: e.target.value })}
          />
          <input
            className="input w-full"
            type="number"
            placeholder="Qté prêtée"
            value={form.qty_loaned}
            onChange={(e) => setForm({ ...form, qty_loaned: e.target.value })}
          />
          <input
            className="input w-full"
            type="number"
            placeholder="Qté déjà rendue"
            value={form.qty_returned}
            onChange={(e) => setForm({ ...form, qty_returned: e.target.value })}
          />
          <button type="button" className="btn-primary w-full" disabled={busy} onClick={() => void save()}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Enregistrer
          </button>
        </div>
      </Modal>
    </div>
  );
}
