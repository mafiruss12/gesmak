import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { listGuests, upsertGuest } from '@/lib/hotel';

export default function HotelGuests() {
  const { activeEstablishment, member } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || '';
  const [list, setList] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', email: '', notes: '' });
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    const { data, error } = await listGuests(estId, q);
    setList(data);
    setErr(error || null);
  }

  useEffect(() => {
    if (estId) void reload();
  }, [estId]);

  async function save() {
    const { error } = await upsertGuest(estId, form);
    if (error) setErr(error);
    else {
      setShow(false);
      setForm({ first_name: '', last_name: '', phone: '', email: '', notes: '' });
      await reload();
    }
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex justify-between items-center gap-2">
        <h1 className="text-xl font-bold">Clients hôtel</h1>
        <button type="button" className="btn-primary text-sm" onClick={() => setShow(true)}>
          + Client
        </button>
      </div>
      <div className="flex gap-2">
        <input
          className="input-field flex-1"
          placeholder="Rechercher nom ou téléphone"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="button" className="btn-secondary" onClick={() => void reload()}>
          OK
        </button>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {show && (
        <div className="card space-y-2 p-4">
          <div className="grid grid-cols-2 gap-2">
            <input className="input-field" placeholder="Prénom" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            <input className="input-field" placeholder="Nom" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
          </div>
          <input className="input-field" placeholder="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="input-field" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <textarea className="input-field" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex gap-2">
            <button type="button" className="btn-primary" onClick={() => void save()}>Enregistrer</button>
            <button type="button" className="btn-secondary" onClick={() => setShow(false)}>Annuler</button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {list.map((g) => (
          <div key={g.id} className="rounded-xl border border-stone-200 bg-white px-3 py-2.5">
            <p className="font-semibold">{g.first_name} {g.last_name}</p>
            <p className="text-xs text-stone-500">{g.phone || '—'} · {g.email || '—'}</p>
            {g.notes && <p className="text-xs text-stone-400 mt-1">{g.notes}</p>}
          </div>
        ))}
        {list.length === 0 && <p className="text-sm text-stone-500 text-center py-6">Aucun client.</p>}
      </div>
    </div>
  );
}
