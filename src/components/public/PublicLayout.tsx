import { useState, ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, MapPin, Heart } from 'lucide-react';

const NAV = [
  { to: '/accueil', label: 'Accueil' },
  { to: '/discover', label: 'Découvrir' },
  { to: '/establishments', label: 'Collections' },
  { to: '/events', label: 'Actus' },
  { to: '/favorites', label: 'Favoris' },
  { to: '/services', label: 'Services' },
];

export default function PublicLayout({
  children,
  onOpenAuth,
  rightSlot,
}: {
  children: ReactNode;
  onOpenAuth?: (mode: 'signin' | 'signup') => void;
  rightSlot?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const loc = useLocation();

  return (
    <div className="min-h-screen bg-[#FBF7F0] text-[#2C2416]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#E8DFD0] shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          {/* Logo STOCK MANAGER AI */}
          <Link to="/accueil" className="flex items-center gap-2.5 min-w-0 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E85D04] to-[#C2410C] flex items-center justify-center text-white shadow-md shadow-orange-600/25 group-hover:scale-105 transition-transform">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
                <path d="M7 2v20" />
                <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
              </svg>
            </div>
            <div className="leading-tight min-w-0">
              <p className="font-bold text-[16px] tracking-tight text-[#2C2416] truncate">
                STOCK MANAGER AI
              </p>
              <p className="text-[10px] text-[#166534] font-semibold tracking-wide truncate uppercase">
                Côte d&apos;Ivoire
              </p>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((n) => {
              const active =
                loc.pathname === n.to ||
                (n.to !== '/' && loc.pathname.startsWith(n.to));
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    active
                      ? 'text-[#E85D04] bg-[#FFF0D6] font-semibold'
                      : 'text-[#6B5E4F] hover:bg-[#F7F0E6] hover:text-[#2C2416]'
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <Link
              to="/discover"
              className="hidden sm:flex items-center gap-1.5 text-sm text-[#6B5E4F] hover:text-[#E85D04] transition"
            >
              <Heart size={16} />
              <span className="hidden lg:inline">Mes favoris</span>
            </Link>

            <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#8A7B6B] px-2">
              <span className="text-base">🇨🇮</span>
              <span>Abidjan</span>
            </div>

            {rightSlot}

            {onOpenAuth && (
              <button
                type="button"
                onClick={() => onOpenAuth('signin')}
                className="h-10 px-4 rounded-xl text-sm font-semibold bg-[#E85D04] text-white hover:bg-[#C2410C] shadow-sm shadow-orange-600/20 transition"
              >
                Se connecter
              </button>
            )}

            <button
              type="button"
              className="md:hidden w-10 h-10 rounded-xl bg-[#F7F0E6] flex items-center justify-center text-[#2C2416]"
              onClick={() => setOpen((v) => !v)}
              aria-label="Menu"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="md:hidden border-t border-[#E8DFD0] bg-white px-4 py-3 space-y-1">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="block px-3 py-2.5 rounded-xl text-sm font-medium text-[#3D3428] hover:bg-[#FBF7F0]"
              >
                {n.label}
              </Link>
            ))}
          </div>
        )}
      </header>

      {children}

      {/* Footer */}
      <footer className="border-t border-[#E8DFD0] bg-white mt-16">
        <div className="max-w-6xl mx-auto px-4 py-12 grid sm:grid-cols-3 gap-10 text-sm">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#E85D04] to-[#C2410C] flex items-center justify-center text-white">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
                  <path d="M7 2v20" />
                  <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-[#2C2416]">STOCK MANAGER AI</p>
                <p className="text-[10px] text-[#166534] font-semibold uppercase">Côte d&apos;Ivoire</p>
              </div>
            </div>
            <p className="text-[#8A7B6B] text-[13px] leading-relaxed">
              La plateforme pour découvrir, promouvoir et vivre les meilleurs
              établissements ivoiriens.
            </p>
          </div>

          <div>
            <p className="font-semibold text-[#2C2416] mb-3">Explorer</p>
            <div className="space-y-2 text-[#6B5E4F]">
              {NAV.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  className="block hover:text-[#E85D04] transition"
                >
                  {n.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="font-semibold text-[#2C2416] mb-3">Kevin Tech Pro</p>
            <p className="text-[#8A7B6B] text-[13px] leading-relaxed">
              Abidjan · Support WhatsApp disponible depuis l&apos;espace
              propriétaire.
            </p>
          </div>
        </div>

        <div className="border-t border-[#E8DFD0] py-4 text-center text-xs text-[#A89880]">
          © {new Date().getFullYear()} STOCK MANAGER AI — Kevin Tech Pro
        </div>
      </footer>
    </div>
  );
}
