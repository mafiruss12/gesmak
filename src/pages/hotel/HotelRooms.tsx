import { useEffect, useRef, useState } from 'react';
import { Camera, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import {
  listRooms,
  listRoomTypes,
  createRoom,
  updateRoom,
  deleteRoom,
  createRoomType,
  updateRoomStatus,
  syncRoomsToQrConfig,
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
  const [editRoomId, setEditRoomId] = useState<string | null>(null);
  const [showType, setShowType] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState({
    number: '',
    name: '',
    floor: '',
    room_type_id: '',
    price: '',
    capacity: '2',
    description: '',
    image_url: '',
    status: 'available' as RoomStatus,
  });
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
    if (!r.error) void syncRoomsToQrConfig(estId);
  }

  useEffect(() => {
    void reload();
  }, [estId]);

  function openNewRoom() {
    setEditRoomId(null);
    setForm({
      number: '',
      name: '',
      floor: '',
      room_type_id: '',
      price: '',
      capacity: '2',
      description: '',
      image_url: '',
      status: 'available',
    });
    setShowAdd(true);
  }

  function openEditRoom(r: any) {
    setEditRoomId(r.id);
    setForm({
      number: r.number || '',
      name: r.room_name || '',
      floor: r.floor || '',
      room_type_id: r.room_type_id || '',
      price: String(r.price_per_night ?? r.hotel_room_types?.price_per_night ?? ''),
      capacity: String(r.capacity ?? r.hotel_room_types?.capacity ?? 2),
      description: r.description || '',
      image_url: r.image_url || '',
      status: (r.status || 'available') as RoomStatus,
    });
    setShowAdd(true);
  }

  async function handlePhotoUpload(file: File) {
    if (!estId) return;
    setUploadingPhoto(true);
    setErr(null);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${estId}/room-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('public-vitrine')
        .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });
      if (!upErr) {
        const { data } = supabase.storage.from('public-vitrine').getPublicUrl(path);
        if (data?.publicUrl) {
          setForm((f) => ({ ...f, image_url: data.publicUrl }));
          return;
        }
      }
      // Fallback compact data URL if storage bucket restricted
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setForm((f) => ({ ...f, image_url: reader.result as string }));
        }
      };
      reader.readAsDataURL(file);
    } catch (e: any) {
      setErr(e?.message || 'Téléversement photo impossible');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function onSaveRoom() {
    if (!form.number.trim()) {
      setErr('Indiquez le numéro de la chambre.');
      return;
    }
    setSaving(true);
    setErr(null);
    const payload = {
      number: form.number.trim(),
      name: form.name.trim() || undefined,
      description: form.description.trim() || undefined,
      image_url: form.image_url.trim() || undefined,
      floor: form.floor.trim() || undefined,
      room_type_id: form.room_type_id || null,
      price_per_night: form.price ? Number(form.price) : 0,
      capacity: form.capacity ? Number(form.capacity) : 2,
      status: form.status,
    };
    const res = editRoomId
      ? await updateRoom(estId, editRoomId, payload)
      : await createRoom(estId, payload);
    setSaving(false);
    if (res.error) setErr(res.error);
    else {
      setShowAdd(false);
      setEditRoomId(null);
      await reload();
    }
  }

  async function onDeleteRoom(r: any) {
    if (!confirm(`Supprimer la chambre Ch. ${r.number} ?`)) return;
    const { error } = await deleteRoom(estId, r.id);
    if (error) setErr(error);
    else await reload();
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
    const { error } = await updateRoomStatus(id, status, estId);
    if (error) setErr(error);
    else await reload();
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-stone-100">Chambres & Tarifs</h1>
          <p className="text-sm text-stone-400">
            {rooms.length} chambre(s) · Visibles sur le menu QR client
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary text-sm" onClick={() => setShowType(true)}>
            + Type
          </button>
          <button type="button" className="btn-primary text-sm" onClick={openNewRoom}>
            + Chambre
          </button>
        </div>
      </div>

      {err && (
        <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {err}
        </div>
      )}

      {showType && (
        <div className="card space-y-3 p-4">
          <h2 className="font-semibold">Nouveau type de chambre</h2>
          <input
            className="input-field"
            placeholder="Ex. Standard, Deluxe, Suite VIP"
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
          <h2 className="font-semibold">
            {editRoomId ? `Modifier Chambre ${form.number}` : 'Nouvelle chambre'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              className="input-field"
              placeholder="Numéro (ex. 101, Suite A)"
              value={form.number}
              onChange={(e) => setForm({ ...form, number: e.target.value })}
            />
            <input
              className="input-field"
              placeholder="Libellé / Nom (ex. Suite Royale)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              className="input-field"
              type="number"
              placeholder="Tarif / nuit (FCFA)"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
            <input
              className="input-field"
              type="number"
              placeholder="Capacité (pers.)"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            />
            <input
              className="input-field"
              placeholder="Étage (ex. RDC, 1er)"
              value={form.floor}
              onChange={(e) => setForm({ ...form, floor: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
            <select
              className="input-field"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as RoomStatus })}
            >
              {(Object.keys(ROOM_STATUS_LABELS) as RoomStatus[]).map((s) => (
                <option key={s} value={s}>
                  {ROOM_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <textarea
            className="input-field min-h-[76px]"
            placeholder="Description (climatisation, Wi-Fi, TV, petit-déjeuner inclus, balcon…)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handlePhotoUpload(file);
                }}
              />
              <button
                type="button"
                disabled={uploadingPhoto}
                onClick={() => fileRef.current?.click()}
                className="btn-secondary text-xs inline-flex items-center gap-1.5"
              >
                <Camera size={14} />
                {uploadingPhoto ? 'Téléversement…' : 'Photo de la chambre'}
              </button>
              <input
                className="input-field flex-1 min-w-[200px] text-xs"
                placeholder="Ou URL image (https://…)"
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              />
            </div>
            {form.image_url && (
              <div className="relative w-40 h-24 rounded-xl overflow-hidden border border-stone-700">
                <img
                  src={form.image_url}
                  alt="Aperçu chambre"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, image_url: '' }))}
                  className="absolute top-1 right-1 px-1.5 py-0.5 text-[10px] rounded bg-black/70 text-white"
                >
                  Retirer
                </button>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-primary" disabled={saving} onClick={onSaveRoom}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-stone-400">Chargement…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rooms.map((r) => {
            const status = (r.status || 'available') as RoomStatus;
            const typeName = r.room_name || r.hotel_room_types?.name;
            const price = r.price_per_night ?? r.hotel_room_types?.price_per_night ?? 0;
            return (
              <div
                key={r.id}
                className={`rounded-2xl border overflow-hidden shadow-sm ${ROOM_STATUS_COLORS[status] || ''}`}
              >
                {r.image_url ? (
                  <img
                    src={r.image_url}
                    alt={`Chambre ${r.number}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-36 object-cover bg-stone-200"
                  />
                ) : (
                  <div className="w-full h-24 bg-gradient-to-br from-amber-500/20 via-stone-200 to-stone-300 flex items-center justify-center text-xs font-semibold text-stone-600">
                    Chambre {r.number}
                  </div>
                )}
                <div className="p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-base font-bold truncate">
                        Ch. {r.number}
                        {typeName ? ` · ${typeName}` : ''}
                      </p>
                      <p className="text-[11px] opacity-80">
                        {r.floor ? `Étage ${r.floor}` : 'Standard'} · {r.capacity || 2} pers. · {ROOM_STATUS_LABELS[status]}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditRoom(r)}
                        className="p-1.5 rounded-lg bg-white/80 text-stone-800 hover:bg-white"
                        aria-label={`Modifier Chambre ${r.number}`}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDeleteRoom(r)}
                        className="p-1.5 rounded-lg bg-white/80 text-rose-700 hover:bg-white"
                        aria-label={`Supprimer Chambre ${r.number}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {r.description && (
                    <p className="text-xs opacity-90 line-clamp-2">{r.description}</p>
                  )}
                  <p className="text-sm font-extrabold tabular-nums">
                    {formatFcfa(Number(price))}{' '}
                    <span className="text-[11px] font-normal">/ nuit</span>
                  </p>
                  <select
                    className="mt-1 w-full text-xs rounded-lg border border-black/10 bg-white/90 px-2 py-1.5 text-stone-800"
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
              </div>
            );
          })}
          {rooms.length === 0 && (
            <p className="col-span-full text-sm text-stone-400 text-center py-8">
              Aucune chambre. Ajoutez vos chambres avec photos, descriptions et tarifs.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
