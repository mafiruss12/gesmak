import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigation, Loader2, MapPin } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { listDepotTours, pushTrackingPoint, latestTrackingByTour, type DepotTour } from '@/lib/depot';
import { supabase } from '@/lib/supabase';
import { EmptyState } from '@/components/ui';

export default function DepotTracking() {
  const { member, activeEstablishment, user } = useAuth();
  const depotId = activeEstablishment?.id || member?.establishment_id || null;
  const [tours, setTours] = useState<DepotTour[]>([]);
  const [activeTourId, setActiveTourId] = useState('');
  const [points, setPoints] = useState<any[]>([]);
  const [tracking, setTracking] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!depotId) return;
    setTours(await listDepotTours(depotId));
    setPoints(await latestTrackingByTour(depotId));
  }, [depotId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!depotId) return;
    const ch = supabase
      .channel('delivery_tracking_' + depotId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'delivery_tracking', filter: `depot_id=eq.${depotId}` },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [depotId, load]);

  useEffect(() => {
    if (!tracking || !activeTourId || !depotId || !user?.id) {
      if (timer.current) window.clearInterval(timer.current);
      return;
    }
    const send = () => {
      if (!navigator.geolocation) {
        setMsg('Géolocalisation non supportée');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const res = await pushTrackingPoint({
            tour_id: activeTourId,
            depot_id: depotId,
            driver_user_id: user.id,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          if (!res.ok) setMsg(res.error || 'Erreur envoi GPS');
          else {
            setMsg(`Position envoyée ${new Date().toLocaleTimeString('fr-FR')}`);
            void load();
          }
        },
        (err) => setMsg(err.message || 'Permission GPS refusée'),
        { enableHighAccuracy: true, maximumAge: 10000 },
      );
    };
    send();
    timer.current = window.setInterval(send, 20000);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [tracking, activeTourId, depotId, user?.id, load]);

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-24">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <Navigation size={22} /> Suivi GPS tournées
      </h1>
      <p className="text-sm text-stone-500">
        Le livreur active le suivi uniquement pendant une tournée. Le gérant voit les dernières positions (Realtime).
      </p>

      <label className="block text-xs text-stone-400">
        Tournée active (livreur)
        <select
          className="input w-full mt-1"
          value={activeTourId}
          onChange={(e) => setActiveTourId(e.target.value)}
        >
          <option value="">—</option>
          {tours
            .filter((t) => t.status !== 'done' && t.status !== 'cancelled')
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.tour_date} · {t.zone || 'Zone'} · {t.driver_name || 'Livreur'}
              </option>
            ))}
        </select>
      </label>

      <button
        type="button"
        className={tracking ? 'btn-secondary w-full' : 'btn-primary w-full'}
        disabled={!activeTourId}
        onClick={() => {
          if (!tracking && !activeTourId) return;
          setTracking((v) => !v);
        }}
      >
        {tracking ? 'Arrêter le suivi GPS' : 'Démarrer le suivi GPS (livreur)'}
      </button>
      {msg && <p className="text-sm text-amber-400">{msg}</p>}

      <h2 className="font-semibold text-stone-200">Positions récentes</h2>
      {points.length === 0 ? (
        <EmptyState icon={<MapPin size={40} />} title="Aucune position" message="Lancez une tournée et activez le GPS livreur." />
      ) : (
        <ul className="space-y-2">
          {points.map((p) => (
            <li key={p.id} className="card p-3 text-sm">
              <div className="font-medium">
                Tournée {String(p.tour_id).slice(0, 8)}…
              </div>
              <div className="text-stone-400">
                {Number(p.lat).toFixed(5)}, {Number(p.lng).toFixed(5)}
              </div>
              <a
                className="text-xs text-sky-400"
                href={`https://www.google.com/maps?q=${p.lat},${p.lng}`}
                target="_blank"
                rel="noreferrer"
              >
                Ouvrir la carte
              </a>
              <div className="text-[10px] text-stone-500">{new Date(p.recorded_at).toLocaleString('fr-FR')}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
