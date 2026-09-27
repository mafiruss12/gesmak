import { useCallback, useEffect, useState } from 'react';
import { Plus, Loader2, Check, Calendar } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import {
  listReservations,
  upsertReservation,
  openOrderForTable,
  type RestaurantReservation,
} from '@/lib/restaurant';
import { useNavigate } from 'react-router-dom';
import { Modal, EmptyState, Badge } from '@/components/ui';

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmée',
  seated: 'Installée',
  cancelled: 'Annulée',
  no_show: 'No-show',
};

export default function Reservations() {
  const navigate = useNavigate();
  const { member, user, activeEstablishment } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const [rows, setRows] = useState<RestaurantReservation[]>([]);
  const [tables, setTables] = useState<{ id: string; number: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState<RestaurantReservation | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    customer_name: '',
    phone: '',
    party_size: '2',
    reservation_time: '',
    table_id: '',
    status: 'confirmed' as RestaurantReservation['status'],
    notes: '',
  });

  const load = useCallback(async () => {
    if (!estId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const [r, t] = await Promise.all([
        listReservations(estId, from.toISOString()),
        supabase
          .from('restaurant_tables')
          .select('id, number')
          .eq('establishment_id', estId)
          .order('number'),
      ]);
      setRows(r);
      setTables((t.data || []) as { id: string; number: string }[]);
    } catch (e: any) {
      setMsg(e?.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [estId]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!estId || !form.customer_name.trim() || !form.reservation_time) return;
    setBusy(true);
    try {
      await upsertReservation(
        estId,
        {
          id: edit?.id,
          table_id: form.table_id || null,
          customer_name: form.customer_name.trim(),
          phone: form.phone.trim() || null,
          party_size: Number(form.party_size) || 2,
          reservation_time: new Date(form.reservation_time).toISOString(),
          status: form.status,
          notes: form.notes || null,
        },
        user?.id,
      );
      if (form.table_id && form.status === 'confirmed') {
        await supabase.from('restaurant_tables').update({ status: 'reserved' }).eq('id', form.table_id);
      }
      if (form.table_id && form.status === 'seated') {
        await supabase.from('restaurant_tables').update({ status: 'occupied' }).eq('id', form.table_id);
      }
      setModal(false);
      setEdit(null);
      await load();
    } catch (e: any) {
      setMsg(e?.message || 'Erreur enregistrement');
    } finally {
      setBusy(false);
    }
  }

  async function seatGuest(r: RestaurantReservation) {
    if (!estId || !user?.id) return;
    if (!confirm(`Installer ${r.customer_name} ?`)) return;
    try {
      await upsertReservation(
        estId,
        {
          id: r.id,
          table_id: r.table_id,
          customer_name: r.customer_name,
          phone: r.phone,
          party_size: r.party_size,
          reservation_time: r.reservation_time,
          status: 'seated',
          notes: r.notes,
        },
        user.id,
      );
      if (r.table_id) {
        const { data: tb } = await supabase
          .from('restaurant_tables')
          .select('id, number')
          .eq('id', r.table_id)
          .maybeSingle();
        if (tb) {
          const orderId = await openOrderForTable({
            estId,
            tableId: tb.id,
            tableNumber: String(tb.number),
            userId: user.id,
            covers: r.party_size,
          });
          navigate(`/orders?order=${orderId}&table=${tb.number}`);
          return;
        }
      }
      await load();
    } catch (e: any) {
      setMsg(e?.message || 'Erreur installation');
    }
  }

  if (!estId) return <div className="card p-4 text-sm">Sélectionnez un établissement.</div>;
  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-stone-500">
        <Loader2 className="animate-spin" size={18} /> Chargement…
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Calendar size={22} /> Réservations
          </h1>
          <p className="text-sm text-stone-500">À partir d’aujourd’hui</p>
        </div>
        <button
          type="button"
          className="btn-primary text-sm"
          onClick={() => {
            setEdit(null);
            const now = new Date();
            now.setMinutes(now.getMinutes() + 60);
            setForm({
              customer_name: '',
              phone: '',
              party_size: '2',
              reservation_time: now.toISOString().slice(0, 16),
              table_id: '',
              status: 'confirmed',
              notes: '',
            });
            setModal(true);
          }}
        >
          <Plus size={16} /> Nouvelle
        </button>
      </div>

      {msg && (
        <div className="card p-3 text-sm text-amber-700">
          {msg}{' '}
          <button type="button" onClick={() => setMsg(null)}>
            ×
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={<Calendar size={40} />} title="Aucune réservation" message="Créez la première réservation." />
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="card p-3 flex justify-between gap-2 items-start">
              <div>
                <div className="font-medium">{r.customer_name}</div>
                <div className="text-xs text-stone-500">
                  {new Date(r.reservation_time).toLocaleString('fr-FR')} · {r.party_size} pers.
                  {r.phone ? ` · ${r.phone}` : ''}
                </div>
                <Badge color="primary">{STATUS_LABEL[r.status] || r.status}</Badge>
              </div>
              <div className="flex flex-col gap-1 items-end">
                {r.status === 'confirmed' && (
                  <button
                    type="button"
                    className="text-sm text-emerald-600 font-medium"
                    onClick={() => void seatGuest(r)}
                  >
                    Installer
                  </button>
                )}
                <button
                  type="button"
                  className="text-sm text-amber-700"
                  onClick={() => {
                    setEdit(r);
                    setForm({
                      customer_name: r.customer_name,
                      phone: r.phone || '',
                      party_size: String(r.party_size),
                      reservation_time: r.reservation_time.slice(0, 16),
                      table_id: r.table_id || '',
                      status: r.status,
                      notes: r.notes || '',
                    });
                    setModal(true);
                  }}
                >
                  Modifier
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={edit ? 'Modifier réservation' : 'Nouvelle réservation'}>
        <div className="space-y-3">
          <input
            className="input w-full"
            placeholder="Nom client"
            value={form.customer_name}
            onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
          />
          <input
            className="input w-full"
            placeholder="Téléphone"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <input
            className="input w-full"
            type="number"
            min={1}
            placeholder="Nombre de personnes"
            value={form.party_size}
            onChange={(e) => setForm((f) => ({ ...f, party_size: e.target.value }))}
          />
          <input
            className="input w-full"
            type="datetime-local"
            value={form.reservation_time}
            onChange={(e) => setForm((f) => ({ ...f, reservation_time: e.target.value }))}
          />
          <select
            className="input w-full"
            value={form.table_id}
            onChange={(e) => setForm((f) => ({ ...f, table_id: e.target.value }))}
          >
            <option value="">Table non assignée</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                Table {t.number}
              </option>
            ))}
          </select>
          <select
            className="input w-full"
            value={form.status}
            onChange={(e) =>
              setForm((f) => ({ ...f, status: e.target.value as RestaurantReservation['status'] }))
            }
          >
            <option value="confirmed">Confirmée</option>
            <option value="seated">Installée</option>
            <option value="cancelled">Annulée</option>
            <option value="no_show">No-show</option>
          </select>
          <textarea
            className="input w-full min-h-[60px]"
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
          <button type="button" className="btn-primary w-full" disabled={busy} onClick={save}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Enregistrer
          </button>
        </div>
      </Modal>
    </div>
  );
}
