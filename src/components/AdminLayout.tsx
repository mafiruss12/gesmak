import { type ReactNode, useState } from 'react';
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard, LogOut, Menu, X, Shield, Building2, Users, CreditCard, MapPin,
  Activity, Clock, Megaphone, KeyRound, RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';

/**
 * Coque visuelle console plateforme GESMAK (indigo/cyan).
 * P0 : menu latéral complet aligné sur les onglets SuperAdmin.
 * P1 : layout plein écran sans bande vide.
 */
const ADMIN_NAV: {
  tab: string;
  label: string;
  icon: typeof LayoutDashboard;
}[] = [
  { tab: 'overview', label: 'Pilotage', icon: LayoutDashboard },
  { tab: 'requests', label: 'Demandes', icon: Clock },
  { tab: 'members', label: 'Membres', icon: Users },
  { tab: 'establishments', label: 'Établissements', icon: Building2 },
  { tab: 'map', label: 'Carte GPS', icon: MapPin },
  { tab: 'subscriptions', label: 'Abonnements', icon: KeyRound },
  { tab: 'activity', label: 'Activité', icon: Activity },
  { tab: 'pubs', label: 'Publicités', icon: Megaphone },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { member, signOut, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const activeTab = searchParams.get('tab') || 'overview';

  async function handleLogout() {
    await signOut();
    navigate('/', { replace: true });
  }

  return (
    <div className="gesmak-admin min-h-[100dvh] flex flex-col text-slate-100">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .gesmak-admin {
          --admin-bg: #0b1220;
          --admin-surface: #111827;
          --admin-border: #1e293b;
          --admin-accent: #6366f1;
          --admin-accent-2: #22d3ee;
          background:
            radial-gradient(ellipse 80% 50% at 100% -10%, rgba(99,102,241,0.22), transparent 50%),
            radial-gradient(ellipse 60% 40% at 0% 100%, rgba(34,211,238,0.1), transparent 45%),
            var(--admin-bg);
        }
        .gesmak-admin .admin-card {
          background: rgba(17, 24, 39, 0.92);
          border: 1px solid var(--admin-border);
          border-radius: 1rem;
        }
        .gesmak-admin .admin-nav-active {
          background: linear-gradient(135deg, rgba(99,102,241,0.4), rgba(34,211,238,0.18));
          color: #e0e7ff;
          border-color: rgba(99,102,241,0.55);
          box-shadow: 0 0 0 1px rgba(99,102,241,0.25);
        }
        .gesmak-admin .admin-kpi {
          transition: transform 0.15s ease, border-color 0.15s ease;
        }
        .gesmak-admin .admin-kpi:active {
          transform: scale(0.98);
        }
        @keyframes admin-pulse-soft {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.72; }
        }
        .gesmak-admin .admin-alert-pulse {
          animation: admin-pulse-soft 2s ease-in-out infinite;
        }
      `,
        }}
      />

      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-md shrink-0">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            type="button"
            className="lg:hidden p-2 rounded-lg bg-slate-800 text-slate-200"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Shield className="text-white" size={18} />
            </div>
            <div className="min-w-0">
              <p className="font-black tracking-tight text-white leading-tight">GESMAK</p>
              <p className="text-[10px] uppercase font-bold tracking-widest text-cyan-300/90">Console</p>
            </div>
          </div>
          <div className="hidden sm:block text-right text-xs text-slate-400 truncate max-w-[180px]">
            {member?.full_name || user?.email || 'GESMAK'}
          </div>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700"
          >
            <LogOut size={14} /> Déconnexion
          </button>
        </div>
      </header>

      <div className="flex-1 max-w-6xl w-full mx-auto px-4 py-4 flex gap-4 items-stretch min-h-0">
        {/* Backdrop mobile */}
        {open && (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            aria-label="Fermer le menu"
            onClick={() => setOpen(false)}
          />
        )}

        <aside
          className={`
            fixed lg:static z-40 lg:z-auto
            top-14 left-0 bottom-0
            w-[min(100%,18rem)] lg:w-56 shrink-0
            bg-slate-950 lg:bg-transparent
            border-r border-slate-800 lg:border-0
            p-3 lg:p-0
            overflow-y-auto
            transition-transform duration-200 ease-out
            ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            flex flex-col
          `}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 mb-2">
            Navigation
          </p>
          <nav className="space-y-1 flex-1">
            {ADMIN_NAV.map((item) => {
              const isActive = activeTab === item.tab;
              return (
                <NavLink
                  key={item.tab}
                  to={item.tab === 'overview' ? '/console' : `/console?tab=${item.tab}`}
                  end={item.tab === 'overview'}
                  onClick={() => setOpen(false)}
                  className={() =>
                    `flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition ${
                      isActive
                        ? 'admin-nav-active'
                        : 'border-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                    }`
                  }
                >
                  <item.icon size={18} />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="mt-4 admin-card p-3 text-[11px] text-slate-400 space-y-1 shrink-0">
            <p className="font-bold text-indigo-300 flex items-center gap-1">
              <Building2 size={12} /> Plateforme
            </p>
            <p>Comptes · Établissements · Abonnements</p>
            <p className="text-slate-500">Espace plateforme GESMAK</p>
          </div>
        </aside>

        <main className="flex-1 min-w-0 flex flex-col min-h-[calc(100dvh-5.5rem)]">
          <div className="flex-1">{children}</div>
        </main>
      </div>
    </div>
  );
}
