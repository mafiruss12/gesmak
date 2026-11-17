import { useCallback, useEffect, useState } from 'react';
import { Truck, Plus, Loader2, Check } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  listDepotTours,
  upsertDepotTour,
  listDepotDeliveries,
  assignDeliveriesToTour,
  type DepotTour,
  type DepotDelivery,
} from '@/lib/depot';
import { EmptyState, Modal, Badge } from '@/components/ui';

export default function DepotTours() {
  const { member, activeEstablishment, user } = useAuth();
  const depotId = activeEstablishment?.id || member?.establishment_id || null;
  const [tours, setTours] = useState<DepotTour[]>([]);
  const [openDeliveries, setOpenDeliveries] = useState<DepotDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    tour_date: new Date().toISOString().slice(0, 10),
    zone: '',
    driver_name: '',
    vehicle_label: '',
    notes: '',
  });
  const [pickIds, setPickIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!depotId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [t, d] = await Promise.all([listDepotTours(depotId), listDepotDeliveries(depotId)]);
    setTours(t);
    setOpenDeliveries(d.filter((x) => ['draft', 'prepared', 'in_transit'].includes(x.status) && !(x as any).tour_id));
    setLoading(false);
  }, [depotId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!depotId) return;
    setBusy(true);
    const res = await upsertDepotTour({
      depot_id: depotId,
      tour_date: form.tour_date,
      zone: form.zone || null,
      driver_name: form.driver_name || null,
      driver_user_id: user?.id || null,
      vehicle_label: form.vehicle_label || null,
      notes: form.notes || null,
      status: 'planned',
    });
    if (res.ok && res.id && pickIds.length) {
      await assignDeliveriesToTour(res.id, pickIds);
    }
    setBusy(false);
    setModal(false);
    setPickIds([]);
    await load();
  }

  if (!depotId) return <div className="card p-4 text-sm">Sélectionnez un dépôt.</div>;
  if (loading) {
    return (
      <div className="flex gap-2 p-6 text-stone-400">
        <Loader2 className="animate-spin" size={18} /> Chargement…
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-24">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Truck size={22} /> Tournées
          </h1>
          <p className="text-sm text-stone-500">Regrouper les livraisons par zone / jour</p>
        </div>
        <button type="button" className="btn-primary text-sm" onClick={() => setModal(true)}>
          <Plus size={16} /> Nouvelle
        </button>
      </div>

      {tours.length === 0 ? (
        <EmptyState icon={<Truck size={40} />} title="Aucune tournée" message="Créez une tournée et assignez des bons." />
      ) : (
        <ul className="space-y-2">
          {tours.map((t) => (
            <li key={t.id} className="card p-3 flex justify-between gap-2">
              <div>
                <div className="font-medium">
                  {t.tour_date} · {t.zone || 'Sans zone'}
                </div>
                <div className="text-xs text-stone-500">
                  {t.driver_name || 'Livreur —'} · {t.vehicle_label || 'Véhicule —'}
                </div>
              </div>
              <Badge>{t.status}</Badge>
            </li>
          ))}
        </ul>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Nouvelle tournée">
        <div className="space-y-3 max-h-[70vh] overflow-y-auto">
          <input
            type="date"
            className="input w-full"
            value={form.tour_date}
            onChange={(e) => setForm({ ...form, tour_date: e.target.value })}
          />
          <input
            className="input w-full"
            placeholder="Zone / secteur"
            value={form.zone}
            onChange={(e) => setForm({ ...form, zone: e.target.value })}
          />
          <input
            className="input w-full"
            placeholder="Livreur / chauffeur"
            value={form.driver_name}
            onChange={(e) => setForm({ ...form, driver_name: e.target.value })}
          />
          <input
            className="input w-full"
            placeholder="Véhicule"
            value={form.vehicle_label}
            onChange={(e) => setForm({ ...form, vehicle_label: e.target.value })}
          />
          <p className="text-xs text-stone-400">Bons à inclure</p>
          {openDeliveries.length === 0 && <p className="text-sm text-stone-500">Aucun bon disponible.</p>}
          {openDeliveries.map((d) => (
            <label key={d.id} className="flex gap-2 text-sm items-center">
              <input
                type="checkbox"
                checked={pickIds.includes(d.id)}
                onChange={(e) =>
                  setPickIds((prev) => (e.target.checked ? [...prev, d.id] : prev.filter((x) => x !== d.id)))
                }
              />
              <span>
                {(d.depot_clients as any)?.name || d.client_id} · {d.status} · {Number(d.total_amount || 0)} F
              </span>
            </label>
          ))}
          <button type="button" className="btn-primary w-full" disabled={busy} onClick={() => void save()}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Enregistrer
          </button>
        </div>
      </Modal>
    </div>
  );
}
