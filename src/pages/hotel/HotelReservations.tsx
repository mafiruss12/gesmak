import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import {
  listReservations,
  listRooms,
  listGuests,
  upsertGuest,
  createReservation,
  checkInReservation,
  checkOutReservation,
  listConsumptions,
  addConsumption,
  RES_STATUS_LABELS,
  formatFcfa,
  type ReservationStatus,
} from '@/lib/hotel';

export default function HotelReservations() {
  const { activeEstablishment, member, user } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || '';
  const [list, setList] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [guests, setGuests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [consumptions, setConsumptions] = useState<any[]>([]);
  const [consForm, setConsForm] = useState({ description: '', unit_price: '', service_code: 'restaurant' });
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    room_id: '',
    check_in: new Date().toISOString().slice(0, 10),
    check_out: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    rate: '',
    amount_paid: '',
    payment_method: 'cash',
  });
  const [saving, setSaving] = useState(false);

  async function reload() {
    if (!estId) return;
    setLoading(true);
    const [r, roomsRes, g] = await Promise.all([
      listReservations(estId),
      listRooms(estId),
      listGuests(estId),
    ]);
    setList(r.data);
    setRooms(roomsRes.data);
    setGuests(g.data);
    setErr(r.error || roomsRes.error || null);
    setLoading(false);
  }

  useEffect(() => {
    void reload();
  }, [estId]);

  useEffect(() => {
    if (!detailId) return;
    void listConsumptions(detailId).then((c) => setConsumptions(c.data));
  }, [detailId]);

  async function onCreate() {
    if (!form.last_name.trim() && !form.first_name.trim()) {
      setErr('Indiquez le nom du client');
      return;
    }
    setSaving(true);
    setErr(null);
    const guestRes = await upsertGuest(estId, {
      first_name: form.first_name.trim() || 'Client',
      last_name: form.last_name.trim() || '—',
      phone: form.phone,
    });
    if (guestRes.error || !guestRes.data) {
      setSaving(false);
      setErr(guestRes.error || 'Client impossible');
      return;
    }
    const { error } = await createReservation(estId, {
      guest_id: guestRes.data.id,
      room_id: form.room_id || null,
      check_in: form.check_in,
      check_out: form.check_out,
      rate: Number(form.rate) || 0,
      amount_paid: Number(form.amount_paid) || 0,
      payment_method: form.payment_method,
      status: 'confirmed',
      created_by: user?.id,
    });
    setSaving(false);
    if (error) setErr(error);
    else {
      setShowNew(false);
      await reload();
    }
  }

  async function onCheckIn(id: string, roomId?: string) {
    const { error } = await checkInReservation(id, roomId);
    if (error) setErr(error);
    else await reload();
  }

  async function onCheckOut(id: string) {
    if (!confirm('Confirmer le check-out ? La chambre passera en nettoyage.')) return;
    const { error } = await checkOutReservation(id, true);
    if (error) setErr(error);
    else {
      setDetailId(null);
      await reload();
    }
  }

  async function onAddCons(reservationId: string, roomId?: string) {
    if (!consForm.description.trim()) return;
    const { error } = await addConsumption(estId, {
      reservation_id: reservationId,
      room_id: roomId,
      service_code: consForm.service_code,
      description: consForm.description.trim(),
      unit_price: Number(consForm.unit_price) || 0,
      created_by: user?.id,
    });
    if (error) setErr(error);
    else {
      setConsForm({ description: '', unit_price: '', service_code: consForm.service_code });
      const c = await listConsumptions(reservationId);
      setConsumptions(c.data);
    }
  }

  const detail = list.find((x) => x.id === detailId);

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Réservations</h1>
          <p className="text-sm text-stone-500">Check-in · Check-out · Consommations</p>
        </div>
        <button type="button" className="btn-primary text-sm" onClick={() => setShowNew(true)}>
          + Réservation
        </button>
      </div>

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      )}

      {showNew && (
        <div className="card space-y-3 p-4">
          <h2 className="font-semibold">Nouvelle réservation</h2>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input-field"
              placeholder="Prénom"
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            />
            <input
              className="input-field"
              placeholder="Nom"
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            />
          </div>
          <input
            className="input-field"
            placeholder="Téléphone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <select
            className="input-field"
            value={form.room_id}
            onChange={(e) => setForm({ ...form, room_id: e.target.value })}
          >
            <option value="">Chambre (optionnel)</option>
            {rooms
              .filter((r) => ['available', 'reserved'].includes(r.status))
              .map((r) => (
                <option key={r.id} value={r.id}>
                  Ch. {r.number} — {r.status}
                </option>
              ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-stone-600">
              Arrivée
              <input
                type="date"
                className="input-field mt-1"
                value={form.check_in}
                onChange={(e) => setForm({ ...form, check_in: e.target.value })}
              />
            </label>
            <label className="text-xs text-stone-600">
              Départ
              <input
                type="date"
                className="input-field mt-1"
                value={form.check_out}
                onChange={(e) => setForm({ ...form, check_out: e.target.value })}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input-field"
              type="number"
              placeholder="Tarif / nuit"
              value={form.rate}
              onChange={(e) => setForm({ ...form, rate: e.target.value })}
            />
            <input
              className="input-field"
              type="number"
              placeholder="Acompte payé"
              value={form.amount_paid}
              onChange={(e) => setForm({ ...form, amount_paid: e.target.value })}
            />
          </div>
          <select
            className="input-field"
            value={form.payment_method}
            onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
          >
            <option value="cash">Espèces</option>
            <option value="mobile_money">Mobile Money</option>
            <option value="card">Carte</option>
            <option value="transfer">Virement</option>
            <option value="other">Autre</option>
          </select>
          <div className="flex gap-2">
            <button type="button" className="btn-primary" disabled={saving} onClick={onCreate}>
              Confirmer
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowNew(false)}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {detail && (
        <div className="card space-y-3 p-4 border-violet-300">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="font-semibold">
                {detail.hotel_guests?.first_name} {detail.hotel_guests?.last_name}
              </h2>
              <p className="text-xs text-stone-500">
                {detail.check_in} → {detail.check_out} · Ch.{' '}
                {detail.hotel_rooms?.number || '—'} ·{' '}
                {RES_STATUS_LABELS[detail.status as ReservationStatus] || detail.status}
              </p>
            </div>
            <button type="button" className="text-sm text-stone-500" onClick={() => setDetailId(null)}>
              Fermer
            </button>
          </div>
          <p className="text-sm">
            Total séjour : <strong>{formatFcfa(Number(detail.total || 0))}</strong> · Payé :{' '}
            {formatFcfa(Number(detail.amount_paid || 0))}
          </p>
          <div className="flex flex-wrap gap-2">
            {['pending', 'confirmed', 'arrived'].includes(detail.status) && (
              <button
                type="button"
                className="btn-primary text-sm"
                onClick={() => void onCheckIn(detail.id, detail.room_id)}
              >
                Check-in
              </button>
            )}
            {detail.status === 'in_progress' && (
              <button
                type="button"
                className="btn-primary text-sm"
                onClick={() => void onCheckOut(detail.id)}
              >
                Check-out
              </button>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2">Consommations (resto / bar / spa…)</h3>
            <ul className="space-y-1 mb-2">
              {consumptions.map((c) => (
                <li key={c.id} className="text-sm flex justify-between border-b border-stone-100 py-1">
                  <span>
                    [{c.service_code}] {c.description}
                  </span>
                  <span className="font-medium">{formatFcfa(Number(c.total))}</span>
                </li>
              ))}
              {consumptions.length === 0 && (
                <li className="text-xs text-stone-400">Aucune consommation</li>
              )}
            </ul>
            <p className="text-sm font-semibold">
              Total conso :{' '}
              {formatFcfa(consumptions.reduce((s, c) => s + Number(c.total || 0), 0))}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-2">
              <select
                className="input-field"
                value={consForm.service_code}
                onChange={(e) => setConsForm({ ...consForm, service_code: e.target.value })}
              >
                <option value="restaurant">Restaurant</option>
                <option value="bar">Bar</option>
                <option value="spa">Spa</option>
                <option value="boutique">Boutique</option>
                <option value="other">Autre</option>
              </select>
              <input
                className="input-field sm:col-span-2"
                placeholder="Description"
                value={consForm.description}
                onChange={(e) => setConsForm({ ...consForm, description: e.target.value })}
              />
              <input
                className="input-field"
                type="number"
                placeholder="Montant"
                value={consForm.unit_price}
                onChange={(e) => setConsForm({ ...consForm, unit_price: e.target.value })}
              />
            </div>
            <button
              type="button"
              className="btn-secondary text-sm mt-2"
              onClick={() => void onAddCons(detail.id, detail.room_id)}
            >
              Ajouter à la chambre
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-stone-500">Chargement…</p>
      ) : (
        <div className="space-y-2">
          {list.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setDetailId(r.id)}
              className="w-full text-left rounded-xl border border-stone-200 bg-white px-3 py-3 hover:border-violet-400 transition"
            >
              <div className="flex justify-between gap-2">
                <div>
                  <p className="font-semibold text-stone-900">
                    {r.hotel_guests?.first_name} {r.hotel_guests?.last_name}
                  </p>
                  <p className="text-xs text-stone-500">
                    {r.check_in} → {r.check_out} · Ch. {r.hotel_rooms?.number || '—'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800">
                    {RES_STATUS_LABELS[r.status as ReservationStatus] || r.status}
                  </span>
                  <p className="text-xs mt-1 font-medium">{formatFcfa(Number(r.total || 0))}</p>
                </div>
              </div>
            </button>
          ))}
          {list.length === 0 && (
            <p className="text-sm text-stone-500 text-center py-8">Aucune réservation.</p>
          )}
        </div>
      )}
    </div>
  );
}
