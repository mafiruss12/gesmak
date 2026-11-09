import { type ReactNode, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, LogOut, Menu, X, Shield, Building2, Users, CreditCard, MapPin, Activity,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';

/**
 * Coque visuelle console plateforme GESMAK (indigo/cyan).
 * Palette : ardoise + indigo / cyan.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const { member, signOut, user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await signOut();
    navigate('/login', { replace: true });
  }

  const nav = [
    { to: '/admin', label: 'Console', icon: LayoutDashboard, end: true },
  ];

  return (
    <div className="gesmak-admin min-h-screen text-slate-100">
      <style dangerouslySetInnerHTML={{ __html: "\n        .gesmak-admin {\n          --admin-bg: #0b1220;\n          --admin-surface: #111827;\n          --admin-border: #1e293b;\n          --admin-accent: #6366f1;\n          --admin-accent-2: #22d3ee;\n          background:\n            radial-gradient(ellipse 80% 50% at 100% -10%, rgba(99,102,241,0.25), transparent 50%),\n            radial-gradient(ellipse 60% 40% at 0% 100%, rgba(34,211,238,0.12), transparent 45%),\n            var(--admin-bg);\n        }\n        .gesmak-admin .admin-card {\n          background: rgba(17, 24, 39, 0.9);\n          border: 1px solid var(--admin-border);\n          border-radius: 1rem;\n        }\n        .gesmak-admin .admin-nav-active {\n          background: linear-gradient(135deg, rgba(99,102,241,0.35), rgba(34,211,238,0.15));\n          color: #e0e7ff;\n          border-color: rgba(99,102,241,0.5);\n        }\n      " }} />

      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
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

      <div className="max-w-6xl mx-auto px-4 py-4 flex gap-4">
        <aside
          className={`
            ${open ? 'block' : 'hidden'} lg:block
            w-full lg:w-56 shrink-0 space-y-1
          `}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 mb-2">Navigation</p>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
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
          ))}
          <div className="mt-6 admin-card p-3 text-[11px] text-slate-400 space-y-1">
            <p className="font-bold text-indigo-300 flex items-center gap-1"><Building2 size={12} /> Plateforme</p>
            <p>Comptes · Établissements · Abonnements</p>
            <p className="text-slate-500">Espace plateforme GESMAK.</p>
          </div>
        </aside>

        <main className="flex-1 min-w-0 pb-16">{children}</main>
      </div>
    </div>
  );
}
