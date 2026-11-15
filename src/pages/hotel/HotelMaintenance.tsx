import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { listMaintenance, createMaintenance, updateMaintenanceStatus, listRooms } from '@/lib/hotel';

export default function HotelMaintenance() {
  const { activeEstablishment, member, user } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || '';
  const [list, setList] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', room_id: '' });
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    const [m, r] = await Promise.all([listMaintenance(estId), listRooms(estId)]);
    setList(m.data);
    setRooms(r.data);
    setErr(m.error || null);
  }

  useEffect(() => {
    if (estId) void reload();
  }, [estId]);

  async function save() {
    if (!form.title.trim()) return;
    const { error } = await createMaintenance(estId, {
      title: form.title.trim(),
      description: form.description,
      priority: form.priority,
      room_id: form.room_id || null,
      created_by: user?.id,
    });
    if (error) setErr(error);
    else {
      setShow(false);
      setForm({ title: '', description: '', priority: 'medium', room_id: '' });
      await reload();
    }
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">Maintenance</h1>
        <button type="button" className="btn-primary text-sm" onClick={() => setShow(true)}>+ Intervention</button>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {show && (
        <div className="card space-y-2 p-4">
          <input className="input-field" placeholder="Problème" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea className="input-field" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select className="input-field" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            <option value="low">Basse</option>
            <option value="medium">Moyenne</option>
            <option value="high">Haute</option>
            <option value="urgent">Urgente</option>
          </select>
          <select className="input-field" value={form.room_id} onChange={(e) => setForm({ ...form, room_id: e.target.value })}>
            <option value="">Chambre (optionnel)</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>Ch. {r.number}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button type="button" className="btn-primary" onClick={() => void save()}>Enregistrer</button>
            <button type="button" className="btn-secondary" onClick={() => setShow(false)}>Annuler</button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {list.map((t) => (
          <div key={t.id} className="rounded-xl border border-stone-200 bg-white p-3">
            <div className="flex justify-between gap-2">
              <div>
                <p className="font-semibold">{t.title}</p>
                <p className="text-xs text-stone-500">
                  {t.priority} · Ch. {t.hotel_rooms?.number || '—'} · {t.status}
                </p>
                {t.description && <p className="text-xs text-stone-400 mt-1">{t.description}</p>}
              </div>
              <select
                className="text-xs rounded-lg border px-2 py-1 h-fit"
                value={t.status}
                onChange={(e) => void updateMaintenanceStatus(t.id, e.target.value as any, t.room_id).then(reload)}
              >
                <option value="open">Ouverte</option>
                <option value="in_progress">En cours</option>
                <option value="done">Terminée</option>
                <option value="cancelled">Annulée</option>
              </select>
            </div>
          </div>
        ))}
        {list.length === 0 && <p className="text-sm text-stone-500 text-center py-8">Aucune intervention.</p>}
      </div>
    </div>
  );
}
