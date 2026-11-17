import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { listEvents, createEvent, formatFcfa } from '@/lib/hotel';

export default function HotelEvents() {
  const { activeEstablishment, member } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || '';
  const [list, setList] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    hall_name: '',
    event_name: '',
    client_name: '',
    client_phone: '',
    event_date: '',
    capacity: '',
    rate: '',
    deposit: '',
  });
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    const { data, error } = await listEvents(estId);
    setList(data);
    setErr(error || null);
  }

  useEffect(() => {
    if (estId) void reload();
  }, [estId]);

  async function save() {
    if (!form.hall_name.trim() || !form.event_name.trim()) return;
    const { error } = await createEvent(estId, {
      hall_name: form.hall_name.trim(),
      event_name: form.event_name.trim(),
      client_name: form.client_name,
      client_phone: form.client_phone,
      event_date: form.event_date || undefined,
      capacity: form.capacity ? Number(form.capacity) : undefined,
      rate: Number(form.rate) || 0,
      deposit: Number(form.deposit) || 0,
    });
    if (error) setErr(error);
    else {
      setShow(false);
      await reload();
    }
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">Événementiel</h1>
        <button type="button" className="btn-primary text-sm" onClick={() => setShow(true)}>+ Événement</button>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {show && (
        <div className="card space-y-2 p-4">
          <input className="input-field" placeholder="Salle" value={form.hall_name} onChange={(e) => setForm({ ...form, hall_name: e.target.value })} />
          <input className="input-field" placeholder="Nom de l'événement" value={form.event_name} onChange={(e) => setForm({ ...form, event_name: e.target.value })} />
          <input className="input-field" placeholder="Client" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
          <input className="input-field" placeholder="Téléphone" value={form.client_phone} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} />
          <input className="input-field" type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
          <div className="grid grid-cols-3 gap-2">
            <input className="input-field" type="number" placeholder="Capacité" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            <input className="input-field" type="number" placeholder="Tarif" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
            <input className="input-field" type="number" placeholder="Acompte" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-primary" onClick={() => void save()}>Enregistrer</button>
            <button type="button" className="btn-secondary" onClick={() => setShow(false)}>Annuler</button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {list.map((e) => (
          <div key={e.id} className="rounded-xl border border-stone-200 bg-white p-3">
            <p className="font-semibold">{e.event_name}</p>
            <p className="text-xs text-stone-500">
              {e.hall_name} · {e.event_date || 'Date —'} · {e.client_name || 'Client —'}
            </p>
            <p className="text-xs mt-1">
              {formatFcfa(Number(e.total || e.rate || 0))} · Acompte {formatFcfa(Number(e.deposit || 0))} · {e.status}
            </p>
          </div>
        ))}
        {list.length === 0 && <p className="text-sm text-stone-500 text-center py-8">Aucun événement.</p>}
      </div>
    </div>
  );
}
