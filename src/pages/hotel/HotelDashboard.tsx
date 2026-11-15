import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BedDouble,
  CalendarCheck,
  ClipboardList,
  LogIn,
  LogOut,
  Wrench,
  Sparkles,
  Building2,
  UtensilsCrossed,
  Wine,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { getDashboardStats, listHotelServices, formatFcfa, isHotelComplex } from '@/lib/hotel';

export default function HotelDashboard() {
  const { activeEstablishment, member } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || '';
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getDashboardStats>> | null>(null);
  const [services, setServices] = useState<{ code: string; name: string; is_active: boolean }[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!estId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [s, svc] = await Promise.all([
          getDashboardStats(estId),
          listHotelServices(estId),
        ]);
        if (!cancelled) {
          setStats(s);
          setServices(svc.data.filter((x: any) => x.is_active));
          setErr(svc.error || null);
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || 'Erreur chargement');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [estId]);

  if (!isHotelComplex(activeEstablishment?.type) && activeEstablishment?.type !== 'complexe') {
    return (
      <div className="card p-6 text-sm text-stone-600">
        Ce module est réservé aux complexes hôteliers.
      </div>
    );
  }

  const cards = [
    {
      label: 'Occupation',
      value: stats ? `${stats.occupancy} %` : '—',
      sub: stats ? `${stats.occupied}/${stats.totalRooms} chambres` : '',
      icon: <BedDouble size={20} />,
      to: '/hotel/rooms',
      color: 'from-violet-500/20 to-purple-600/10 border-violet-300',
    },
    {
      label: 'Disponibles',
      value: stats?.available ?? '—',
      sub: 'Chambres libres',
      icon: <Building2 size={20} />,
      to: '/hotel/rooms',
      color: 'from-emerald-500/20 to-green-600/10 border-emerald-300',
    },
    {
      label: 'Arrivées aujourd’hui',
      value: stats?.arrivals ?? '—',
      sub: 'Check-in prévus',
      icon: <LogIn size={20} />,
      to: '/hotel/reservations',
      color: 'from-sky-500/20 to-blue-600/10 border-sky-300',
    },
    {
      label: 'Départs aujourd’hui',
      value: stats?.departures ?? '—',
      sub: 'Check-out prévus',
      icon: <LogOut size={20} />,
      to: '/hotel/reservations',
      color: 'from-amber-500/20 to-orange-600/10 border-amber-300',
    },
    {
      label: 'CA réservations',
      value: stats ? formatFcfa(stats.revenueMonth) : '—',
      sub: stats ? `Encaissé ${formatFcfa(stats.paidMonth)}` : '',
      icon: <CalendarCheck size={20} />,
      to: '/hotel/reservations',
      color: 'from-yellow-500/20 to-amber-600/10 border-yellow-300',
    },
    {
      label: 'Nettoyage',
      value: stats?.housekeepingPending ?? '—',
      sub: 'Tâches en attente',
      icon: <Sparkles size={20} />,
      to: '/hotel/housekeeping',
      color: 'from-cyan-500/20 to-teal-600/10 border-cyan-300',
    },
    {
      label: 'Maintenance',
      value: stats?.maintenanceOpen ?? '—',
      sub: 'Interventions ouvertes',
      icon: <Wrench size={20} />,
      to: '/hotel/maintenance',
      color: 'from-orange-500/20 to-red-600/10 border-orange-300',
    },
    {
      label: 'Réservations actives',
      value: stats?.reservationsActive ?? '—',
      sub: 'En cours / confirmées',
      icon: <ClipboardList size={20} />,
      to: '/hotel/reservations',
      color: 'from-indigo-500/20 to-violet-600/10 border-indigo-300',
    },
  ];

  const serviceLinks: Record<string, { to: string; icon: React.ReactNode }> = {
    hebergement: { to: '/hotel/rooms', icon: <BedDouble size={18} /> },
    restaurant: { to: '/orders', icon: <UtensilsCrossed size={18} /> },
    bar: { to: '/pos', icon: <Wine size={18} /> },
    cuisine: { to: '/kitchen', icon: <UtensilsCrossed size={18} /> },
    housekeeping: { to: '/hotel/housekeeping', icon: <Sparkles size={18} /> },
    maintenance: { to: '/hotel/maintenance', icon: <Wrench size={18} /> },
    evenementiel: { to: '/hotel/events', icon: <CalendarCheck size={18} /> },
    boutique: { to: '/inventory', icon: <Building2 size={18} /> },
    spa: { to: '/hotel/services', icon: <Sparkles size={18} /> },
    piscine: { to: '/hotel/services', icon: <Sparkles size={18} /> },
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">
          Dashboard — Complexe hôtelier
        </h1>
        <p className="text-sm text-stone-500 mt-0.5">
          {activeEstablishment?.name || 'Complexe'} · Vue globale
        </p>
      </div>

      {err && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {err.includes('does not exist') || err.includes('schema cache')
            ? 'Tables hôtel non encore appliquées en base. Exécutez la migration complexe_hotelier sur Supabase.'
            : err}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-stone-500">Chargement…</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {cards.map((c) => (
            <Link
              key={c.label}
              to={c.to}
              className={`rounded-2xl border bg-gradient-to-br p-3.5 shadow-sm hover:shadow-md transition ${c.color}`}
            >
              <div className="flex items-center gap-2 text-stone-600 mb-2">
                {c.icon}
                <span className="text-[11px] font-semibold uppercase tracking-wide">{c.label}</span>
              </div>
              <p className="text-lg font-bold text-stone-900">{c.value}</p>
              {c.sub && <p className="text-[11px] text-stone-500 mt-0.5">{c.sub}</p>}
            </Link>
          ))}
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-stone-800 mb-2">Services actifs</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {services.length === 0 ? (
            <Link
              to="/hotel/services"
              className="col-span-full rounded-xl border border-dashed border-violet-300 bg-violet-50 px-4 py-6 text-center text-sm text-violet-800"
            >
              Configurer les services du complexe →
            </Link>
          ) : (
            services.map((s) => {
              const link = serviceLinks[s.code] || { to: '/hotel/services', icon: <Building2 size={18} /> };
              return (
                <Link
                  key={s.code}
                  to={link.to}
                  className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm font-medium text-stone-800 hover:border-violet-400 hover:bg-violet-50 transition"
                >
                  <span className="text-violet-600">{link.icon}</span>
                  {s.name}
                </Link>
              );
            })
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Link to="/hotel/rooms" className="btn-primary text-center text-sm py-2.5">
          Chambres
        </Link>
        <Link to="/hotel/reservations" className="btn-primary text-center text-sm py-2.5">
          Réservations
        </Link>
        <Link to="/hotel/guests" className="btn-primary text-center text-sm py-2.5">
          Clients
        </Link>
        <Link to="/hotel/settings" className="btn-primary text-center text-sm py-2.5">
          Paramètres
        </Link>
      </div>
    </div>
  );
}
