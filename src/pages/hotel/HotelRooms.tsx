import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import {
  listRooms,
  listRoomTypes,
  createRoom,
  createRoomType,
  updateRoomStatus,
  ROOM_STATUS_LABELS,
  ROOM_STATUS_COLORS,
  type RoomStatus,
  formatFcfa,
} from '@/lib/hotel';

export default function HotelRooms() {
  const { activeEstablishment, member } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || '';
  const [rooms, setRooms] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showType, setShowType] = useState(false);
  const [form, setForm] = useState({ number: '', floor: '', room_type_id: '', price: '' });
  const [typeForm, setTypeForm] = useState({ name: '', capacity: '2', beds: '1', price: '' });
  const [saving, setSaving] = useState(false);

  async function reload() {
    if (!estId) return;
    setLoading(true);
    const [r, t] = await Promise.all([listRooms(estId), listRoomTypes(estId)]);
    setRooms(r.data);
    setTypes(t.data);
    setErr(r.error || t.error || null);
    setLoading(false);
  }

  useEffect(() => {
    void reload();
  }, [estId]);

  async function onAddRoom() {
    if (!form.number.trim()) return;
    setSaving(true);
    const { error } = await createRoom(estId, {
      number: form.number.trim(),
      floor: form.floor || undefined,
      room_type_id: form.room_type_id || null,
      price_per_night: form.price ? Number(form.price) : undefined,
    });
    setSaving(false);
    if (error) setErr(error);
    else {
      setShowAdd(false);
      setForm({ number: '', floor: '', room_type_id: '', price: '' });
      await reload();
    }
  }

  async function onAddType() {
    if (!typeForm.name.trim()) return;
    setSaving(true);
    const { error } = await createRoomType(estId, {
      name: typeForm.name.trim(),
      capacity: Number(typeForm.capacity) || 2,
      beds: Number(typeForm.beds) || 1,
      price_per_night: Number(typeForm.price) || 0,
    });
    setSaving(false);
    if (error) setErr(error);
    else {
      setShowType(false);
      setTypeForm({ name: '', capacity: '2', beds: '1', price: '' });
      await reload();
    }
  }

  async function setStatus(id: string, status: RoomStatus) {
    const { error } = await updateRoomStatus(id, status);
    if (error) setErr(error);
    else await reload();
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Chambres</h1>
          <p className="text-sm text-stone-500">{rooms.length} chambre(s)</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary text-sm" onClick={() => setShowType(true)}>
            + Type
          </button>
          <button type="button" className="btn-primary text-sm" onClick={() => setShowAdd(true)}>
            + Chambre
          </button>
        </div>
      </div>

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      )}

      {showType && (
        <div className="card space-y-3 p-4">
          <h2 className="font-semibold">Nouveau type de chambre</h2>
          <input
            className="input-field"
            placeholder="Ex. Standard, Deluxe, Suite"
            value={typeForm.name}
            onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              className="input-field"
              type="number"
              placeholder="Capacité"
              value={typeForm.capacity}
              onChange={(e) => setTypeForm({ ...typeForm, capacity: e.target.value })}
            />
            <input
              className="input-field"
              type="number"
              placeholder="Lits"
              value={typeForm.beds}
              onChange={(e) => setTypeForm({ ...typeForm, beds: e.target.value })}
            />
            <input
              className="input-field"
              type="number"
              placeholder="Prix / nuit"
              value={typeForm.price}
              onChange={(e) => setTypeForm({ ...typeForm, price: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-primary" disabled={saving} onClick={onAddType}>
              Enregistrer
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowType(false)}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="card space-y-3 p-4">
          <h2 className="font-semibold">Nouvelle chambre</h2>
          <input
            className="input-field"
            placeholder="Numéro (ex. 101)"
            value={form.number}
            onChange={(e) => setForm({ ...form, number: e.target.value })}
          />
          <input
            className="input-field"
            placeholder="Étage"
            value={form.floor}
            onChange={(e) => setForm({ ...form, floor: e.target.value })}
          />
          <select
            className="input-field"
            value={form.room_type_id}
            onChange={(e) => setForm({ ...form, room_type_id: e.target.value })}
          >
            <option value="">Type (optionnel)</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — {formatFcfa(Number(t.price_per_night || 0))}
              </option>
            ))}
          </select>
          <input
            className="input-field"
            type="number"
            placeholder="Prix / nuit (si différent du type)"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />
          <div className="flex gap-2">
            <button type="button" className="btn-primary" disabled={saving} onClick={onAddRoom}>
              Enregistrer
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-stone-500">Chargement…</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {rooms.map((r) => {
            const status = (r.status || 'available') as RoomStatus;
            const typeName = r.hotel_room_types?.name;
            const price = r.price_per_night ?? r.hotel_room_types?.price_per_night ?? 0;
            return (
              <div
                key={r.id}
                className={`rounded-2xl border p-3 shadow-sm ${ROOM_STATUS_COLORS[status] || ''}`}
              >
                <p className="text-lg font-bold">Ch. {r.number}</p>
                {typeName && <p className="text-xs opacity-80">{typeName}</p>}
                {r.floor && <p className="text-[11px]">Étage {r.floor}</p>}
                <p className="text-xs mt-1 font-medium">{ROOM_STATUS_LABELS[status]}</p>
                {price > 0 && (
                  <p className="text-[11px] mt-0.5 opacity-80">{formatFcfa(Number(price))}/nuit</p>
                )}
                <select
                  className="mt-2 w-full text-xs rounded-lg border border-black/10 bg-white/80 px-2 py-1.5 text-stone-800"
                  value={status}
                  onChange={(e) => void setStatus(r.id, e.target.value as RoomStatus)}
                >
                  {(Object.keys(ROOM_STATUS_LABELS) as RoomStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {ROOM_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
          {rooms.length === 0 && (
            <p className="col-span-full text-sm text-stone-500 text-center py-8">
              Aucune chambre. Ajoutez un type puis des chambres.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
