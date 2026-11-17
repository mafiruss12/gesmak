import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, MapPin, ChevronRight, Loader2, UtensilsCrossed,
  Wine, ArrowRight, Flame, Leaf, Music, Sandwich, Star,
  Camera, Sparkles, Users, Mic2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import PublicLayout from '@/components/public/PublicLayout';
import AuthModal, { AuthMode } from '@/components/public/AuthModal';
import { slugify, isOpenNow, type OpeningHours } from '@/lib/publicEstablishment';

type PubEst = {
  id: string;
  name: string;
  type: string | null;
  address: string | null;
  phone: string | null;
  logo_url?: string | null;
  public_menu?: boolean;
  opening_hours?: OpeningHours | null;
  is_sponsored?: boolean | null;
};

const CATEGORIES = [
  { id: 'restaurant', label: 'Restaurants', icon: UtensilsCrossed },
  { id: 'maquis', label: 'Maquis', icon: Leaf },
  { id: 'bar', label: 'Bars', icon: Wine },
  { id: 'lounge', label: 'Lounges', icon: Music },
  { id: 'fastfood', label: 'Fast-foods', icon: Sandwich },
];

const SERVICES = [
  { icon: Mic2, title: 'DJ & Animation', desc: 'Ambiance garantie pour vos soirées', color: 'from-purple-500 to-pink-500' },
  { icon: Camera, title: 'Photographe', desc: 'Capturez vos meilleurs moments', color: 'from-blue-500 to-cyan-500' },
  { icon: Users, title: 'Traiteur', desc: 'Cuisine pour événements privés', color: 'from-orange-500 to-amber-500' },
  { icon: Sparkles, title: 'Décoration', desc: 'Mise en scène élégante', color: 'from-emerald-500 to-teal-500' },
];

export default function PublicHome() {
  useEffect(() => {
    document.title = 'GESMAK — Découvrez les meilleurs établissements';
  }, []);

  const { user, signOut } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [q, setQ] = useState('');
  const [ests, setEsts] = useState<PubEst[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('establishments')
        .select('id, name, type, address, phone, logo_url, public_menu, opening_hours, is_sponsored')
        .eq('public_menu', true)
        .order('name')
        .limit(48);
      if (!cancelled) {
        setEsts((data as PubEst[]) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredEsts = useMemo(() => {
    let list = ests;
    const s = q.trim().toLowerCase();
    if (s) {
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(s) ||
          String(e.type || '').toLowerCase().includes(s) ||
          String(e.address || '').toLowerCase().includes(s)
      );
    }
    return [...list].sort((a, b) => Number(!!b.is_sponsored) - Number(!!a.is_sponsored));
  }, [ests, q]);

  function openAuth(mode: AuthMode) {
    setAuthMode(mode);
    setAuthOpen(true);
  }

  const rightSlot = user ? (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => window.location.assign('/dashboard')}
        className="h-10 px-3 rounded-xl text-sm font-semibold bg-[#FFF0D6] text-[#C2410C] hover:bg-[#FFE4B8] transition"
      >
        Mon espace
      </button>
      <button type="button" onClick={() => void signOut()} className="text-xs text-[#8A7B6B] hover:text-[#2C2416]">
        Quitter
      </button>
    </div>
  ) : null;

  return (
    <PublicLayout onOpenAuth={user ? undefined : openAuth} rightSlot={rightSlot}>
      <AuthModal open={authOpen} mode={authMode} onClose={() => setAuthOpen(false)} onMode={setAuthMode} />

      {/* ========== HERO — même structure que le mockup validé ========== */}
      <section className="relative bg-[#FBF7F0] overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 py-10 lg:py-14">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-6 items-center">
            
            {/* Colonne gauche — textes + recherche */}
            <div className="relative z-10">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E85D04] mb-4">
                <MapPin size={13} />
                Le meilleur de la Côte d&apos;Ivoire, près de chez vous.
              </p>

              <h1 className="text-[2.4rem] sm:text-[2.8rem] lg:text-[3.2rem] font-bold text-[#2C2416] leading-[1.15] tracking-tight">
                Découvrez les{' '}
                <span
                  className="text-[#E85D04] block sm:inline"
                  style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic', fontWeight: 600 }}
                >
                  meilleurs établissements
                </span>
              </h1>

              <p className="mt-4 text-[#6B5E4F] text-base max-w-md leading-relaxed">
                Restaurants, maquis, bars et fast-foods authentiques pour des moments savoureux.
              </p>

              {/* Barre de recherche */}
              <div className="mt-7 flex flex-col sm:flex-row gap-2 max-w-lg">
                <div className="flex-1 flex items-center bg-white rounded-2xl border border-[#E8DFD0] shadow-sm overflow-hidden">
                  <div className="pl-3.5 text-[#A89880]">
                    <Search size={18} />
                  </div>
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Rechercher un établissement, un plat ou un quartier..."
                    className="flex-1 h-12 px-3 text-sm text-[#2C2416] placeholder:text-[#A89880] focus:outline-none bg-transparent min-w-0"
                  />
                  <div className="hidden sm:flex items-center gap-1.5 px-3 border-l border-[#E8DFD0] text-[#8A7B6B] text-sm shrink-0">
                    <MapPin size={14} className="text-[#E85D04]" />
                    Abidjan
                  </div>
                </div>
                <Link
                  to={`/establishments${q ? `?q=${encodeURIComponent(q)}` : ''}`}
                  className="h-12 px-5 rounded-2xl bg-[#E85D04] hover:bg-[#C2410C] text-white font-semibold text-sm flex items-center justify-center gap-2 transition shadow-md shadow-orange-600/20 shrink-0"
                >
                  <Search size={18} />
                </Link>
              </div>
            </div>

            {/* Colonne droite — grande image dame qui mange + carte spot */}
            <div className="relative">
              <div className="rounded-3xl overflow-hidden shadow-2xl aspect-[4/3] relative">
                <img
                  src="/hero-dame.jpg"
                  alt="Dame qui savoure un repas au maquis"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Carte flottante "Le spot du moment" */}
              <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 bg-white rounded-2xl shadow-xl border border-[#E8DFD0] p-3 flex items-center gap-3 max-w-[220px]">
                <img
                  src="/hero-dame.jpg"
                  alt=""
                  className="w-12 h-12 rounded-xl object-cover shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-[#E85D04] flex items-center gap-1">
                    <Flame size={11} /> Le spot du moment
                  </p>
                  <p className="font-bold text-sm text-[#2C2416] truncate">Chez Mama Africa</p>
                  <p className="text-xs text-[#6B5E4F] flex items-center gap-1 mt-0.5">
                    <Star size={11} className="fill-[#E85D04] text-[#E85D04]" /> 4,8 (230)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 space-y-12 pb-16">
        {/* Catégories */}
        <section className="-mt-2">
          <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide items-center">
            {CATEGORIES.map((c, idx) => {
              const Icon = c.icon;
              return (
                <Link
                  key={c.id}
                  to={`/establishments?type=${c.id}`}
                  className={`flex items-center gap-2 shrink-0 px-4 py-2.5 rounded-full text-sm font-semibold transition hover:scale-105 ${
                    idx === 0
                      ? 'bg-[#E85D04] text-white shadow-sm'
                      : 'bg-white border border-[#E8DFD0] text-[#6B5E4F] hover:border-[#E85D04]/40 hover:text-[#E85D04]'
                  }`}
                >
                  <Icon size={15} />
                  {c.label}
                </Link>
              );
            })}
            <Link to="/establishments" className="text-sm font-semibold text-[#E85D04] whitespace-nowrap ml-2 hover:underline">
              Voir tout →
            </Link>
          </div>
        </section>

        {/* Établissements populaires */}
        <section>
          <div className="flex items-end justify-between gap-3 mb-6">
            <h2 className="text-2xl font-bold text-[#2C2416]">Établissements populaires</h2>
            <Link to="/establishments" className="text-sm font-semibold text-[#E85D04] hover:text-[#C2410C] flex items-center gap-1">
              Voir tous les établissements <ChevronRight size={16} />
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-[#E85D04]" size={28} />
            </div>
          ) : filteredEsts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#E8DFD0] bg-white p-12 text-center">
              <p className="font-semibold text-[#2C2416]">Aucune vitrine publique pour le moment</p>
              <p className="text-sm text-[#8A7B6B] mt-2 max-w-md mx-auto">
                Les établissements apparaîtront ici dès qu&apos;un propriétaire active le menu public.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {filteredEsts.slice(0, 5).map((est) => {
                const open = isOpenNow(est.opening_hours) === true;
                return (
                  <Link
                    key={est.id}
                    to={`/e/${slugify(est.name, est.id)}`}
                    className="rounded-2xl border border-[#E8DFD0] bg-white overflow-hidden shadow-sm hover:shadow-xl hover:border-[#E85D04]/25 hover:-translate-y-1 transition-all duration-300 group"
                  >
                    <div className="h-32 sm:h-36 bg-[#F7F0E6] relative overflow-hidden">
                      {est.logo_url ? (
                        <img
                          src={est.logo_url}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#C4B5A0]">
                          <UtensilsCrossed size={28} />
                        </div>
                      )}
                      <span className="absolute top-2 left-2 text-[10px] font-bold bg-white/95 text-[#2C2416] px-2 py-0.5 rounded-md capitalize shadow-sm">
                        {est.type || 'Établissement'}
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="font-bold text-sm text-[#2C2416] truncate">{est.name}</p>
                      {est.address && (
                        <p className="mt-1 text-[11px] text-[#8A7B6B] flex items-center gap-1 truncate">
                          <MapPin size={11} className="text-[#E85D04] shrink-0" />
                          {est.address}
                        </p>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <span className={`text-[11px] font-semibold flex items-center gap-1 ${open ? 'text-emerald-700' : 'text-[#A89880]'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${open ? 'bg-emerald-500' : 'bg-[#D6CBB8]'}`} />
                          {open ? 'Ouvert' : '—'}
                        </span>
                        <span className="text-xs font-medium text-[#6B5E4F] flex items-center gap-0.5">
                          <Star size={11} className="fill-[#E85D04] text-[#E85D04]" />
                          4.6
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Services */}
        <section>
          <div className="flex items-end justify-between gap-3 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-[#2C2416]">Services & Prestataires</h2>
              <p className="text-sm text-[#8A7B6B] mt-1">DJ, photographes, traiteurs et plus encore</p>
            </div>
            <Link to="/services" className="text-sm font-semibold text-[#E85D04] hover:text-[#C2410C] flex items-center gap-1">
              Voir tout <ChevronRight size={16} />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SERVICES.map((s) => {
              const Icon = s.icon;
              return (
                <Link
                  key={s.title}
                  to="/services"
                  className="group relative rounded-2xl overflow-hidden bg-white border border-[#E8DFD0] p-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-white mb-4 shadow-md group-hover:scale-110 transition-transform`}>
                    <Icon size={22} />
                  </div>
                  <p className="font-bold text-[#2C2416]">{s.title}</p>
                  <p className="text-sm text-[#8A7B6B] mt-1">{s.desc}</p>
                </Link>
              );
            })}
          </div>
        </section>

        {/* CTA */}
        <section className="rounded-3xl bg-gradient-to-br from-[#E85D04] to-[#9a3412] p-8 sm:p-11 text-center text-white">
          <h2 className="text-2xl sm:text-3xl font-bold">Vous êtes propriétaire ?</h2>
          <p className="mt-3 text-white/85 max-w-md mx-auto">
            Créez votre vitrine gratuite, publiez votre menu et attirez plus de clients dès aujourd&apos;hui.
          </p>
          <button
            type="button"
            onClick={() => openAuth('signup')}
            className="mt-6 inline-flex items-center gap-2 h-12 px-8 rounded-xl bg-white text-[#C2410C] font-bold text-sm hover:bg-[#FFF0D6] transition shadow-lg"
          >
            Créer mon établissement
            <ArrowRight size={18} />
          </button>
        </section>
      </div>
    </PublicLayout>
  );
}
