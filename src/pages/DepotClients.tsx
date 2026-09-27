import { useEffect, useState } from 'react';
import { Users, Plus, Pencil, Link2, Phone } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  listDepotClients,
  upsertDepotClient,
  listMaquisEstablishments,
  type DepotClient,
} from '@/lib/depot';
import { EmptyState } from '@/components/ui';

export default function DepotClients() {
  const { activeEstablishment, member } = useAuth();
  const depotId = activeEstablishment?.id || member?.establishment_id || null;
  const [clients, setClients] = useState<DepotClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<DepotClient | null>(null);
  const [maquis, setMaquis] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    zone: '',
    payment_terms: 'cash',
    linked_establishment_id: '',
    notes: '',
    credit_limit: '',
    payment_days: '0',
    lat: '',
    lng: '',
  });

  async function load() {
    if (!depotId) {
      setClients([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [c, m] = await Promise.all([listDepotClients(depotId), listMaquisEstablishments()]);
    setClients(c);
    setMaquis(m);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depotId]);

  function openAdd() {
    setEditing(null);
    setForm({
      name: '',
      phone: '',
      address: '',
      zone: '',
      payment_terms: 'cash',
      linked_establishment_id: '',
      notes: '',
    });
    setModal(true);
  }

  function openEdit(c: DepotClient) {
    setEditing(c);
    setForm({
      name: c.name || '',
      phone: c.phone || '',
      address: c.address || '',
      zone: c.zone || '',
      payment_terms: c.payment_terms || 'cash',
      linked_establishment_id: c.linked_establishment_id || '',
      notes: c.notes || '',
    });
    setModal(true);
  }

  async function save() {
    if (!depotId || !form.name.trim()) {
      alert('Nom du client obligatoire');
      return;
    }
    const r = await upsertDepotClient({
      id: editing?.id,
      depot_id: depotId,
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      zone: form.zone.trim() || null,
      payment_terms: form.payment_terms,
      linked_establishment_id: form.linked_establishment_id || null,
      notes: form.notes.trim() || null,
      status: 'active',
      credit_limit: Number((form as any).credit_limit) || 0,
      payment_days: Number((form as any).payment_days) || 0,
      lat: (form as any).lat ? Number((form as any).lat) : null,
      lng: (form as any).lng ? Number((form as any).lng) : null,
    } as any);
    if (!r.ok) {
      alert(r.error || 'Erreur');
      return;
    }
    setModal(false);
    await load();
  }

  if (!depotId) {
    return <p className="p-4 text-stone-500">Aucun établissement dépôt sélectionné.</p>;
  }

  return (
    <div className="max-w-3xl mx-auto p-4 pb-28 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-stone-100 flex items-center gap-2">
            <Users className="text-teal-400" size={22} /> Clients maquis / bars
          </h1>
          <p className="text-sm text-stone-400">Établissements que vous livrez</p>
        </div>
        <button type="button" onClick={openAdd} className="btn-primary flex items-center gap-1.5 text-sm">
          <Plus size={16} /> Ajouter
        </button>
      </div>

      {loading ? (
        <p className="text-stone-400 text-sm">Chargement…</p>
      ) : clients.length === 0 ? (
        <EmptyState
          icon={<Users size={40} />}
          title="Aucun client"
          message="Ajoutez les maquis, bars et restaurants que vous livrez."
        />
      ) : (
        <ul className="space-y-2">
          {clients.map((c) => (
            <li
              key={c.id}
              className="rounded-2xl border border-stone-800 bg-stone-900/50 p-4 flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="font-semibold text-stone-100 truncate">{c.name}</p>
                {c.phone && (
                  <p className="text-xs text-stone-400 flex items-center gap-1 mt-0.5">
                    <Phone size={12} /> {c.phone}
                  </p>
                )}
                {(c.zone || c.address) && (
                  <p className="text-xs text-stone-500 mt-1 truncate">
                    {[c.zone, c.address].filter(Boolean).join(' · ')}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mt-2 text-[11px]">
                  <span className="px-2 py-0.5 rounded-full bg-stone-800 text-stone-300">
                    {c.payment_terms === 'credit' ? 'Crédit' : 'Cash'}
                  </span>
                  {Number(c.balance) > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                      Encours {Number(c.balance).toLocaleString('fr-FR')} F
                    </span>
                  )}
                  {c.linked_establishment_id && (
                    <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 flex items-center gap-1">
                      <Link2 size={10} /> Lié Stock Manager
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => openEdit(c)}
                className="p-2 rounded-xl border border-stone-700 text-stone-400 hover:text-amber-300"
              >
                <Pencil size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-3">
          <div className="w-full max-w-md rounded-2xl bg-stone-900 border border-stone-700 p-4 space-y-3 max-h-[90vh] overflow-y-auto">
            <h2 className="font-semibold text-stone-100">{editing ? 'Modifier client' : 'Nouveau client'}</h2>
            <input
              className="input-field"
              placeholder="Nom du maquis / bar *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="input-field"
              placeholder="Téléphone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <input
              className="input-field"
              placeholder="Zone / quartier"
              value={form.zone}
              onChange={(e) => setForm({ ...form, zone: e.target.value })}
            />
            <input
              className="input-field"
              placeholder="Adresse"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
            <select
              className="input-field"
              value={form.payment_terms}
              onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
            >
              <option value="cash">Paiement cash</option>
              <option value="credit">Crédit / encours</option>
            </select>
            <div>
              <label className="text-xs text-stone-400 mb-1 block">Lier un établissement Stock Manager (sync stock)</label>
              <select
                className="input-field"
                value={form.linked_establishment_id}
                onChange={(e) => setForm({ ...form, linked_establishment_id: e.target.value })}
              >
                <option value="">— Pas de lien —</option>
                {maquis.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              className="input-field min-h-[72px]"
              placeholder="Notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
            <div className="flex gap-2 pt-1">
              <button type="button" className="btn-ghost flex-1" onClick={() => setModal(false)}>
                Annuler
              </button>
              <button type="button" className="btn-primary flex-1" onClick={() => void save()}>
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
