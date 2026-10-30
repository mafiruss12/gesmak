import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Loader2, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import PublicLayout from '@/components/public/PublicLayout';
import AuthModal, { AuthMode } from '@/components/public/AuthModal';
import { getFavoriteIds, slugify, isOpenNow, type OpeningHours } from '@/lib/publicEstablishment';

type Est = {
  id: string;
  name: string;
  type: string | null;
  address: string | null;
  logo_url?: string | null;
  opening_hours?: OpeningHours | null;
};

export default function PublicFavorites() {
  useEffect(() => {
    document.title = 'Favoris · GESMAK';
  }, []);
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [list, setList] = useState<Est[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const ids = getFavoriteIds();
      if (!ids.length) {
        setList([]);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('establishments')
        .select('id, name, type, address, logo_url, opening_hours, public_menu')
        .in('id', ids)
        .eq('public_menu', true);
      setList((data as Est[]) || []);
      setLoading(false);
    })();
  }, []);

  return (
    <PublicLayout onOpenAuth={user ? undefined : (m) => { setAuthMode(m); setAuthOpen(true); }}>
      <AuthModal open={authOpen} mode={authMode} onClose={() => setAuthOpen(false)} onMode={setAuthMode} />
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Heart className="text-[#E85D04]" size={22} /> Mes favoris
        </h1>
        <p className="text-sm text-slate-500 mt-1">Enregistrés sur cet appareil</p>
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#E85D04]" /></div>
        ) : list.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            Aucun favori pour le moment. Ouvrez une fiche établissement et appuyez sur ★ Favori.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {list.map((est) => {
              const o = isOpenNow(est.opening_hours);
              return (
                <Link
                  key={est.id}
                  to={`/e/${slugify(est.name, est.id)}`}
                  className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3 hover:shadow-md transition"
                >
                  <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                    {est.logo_url ? (
                      <img src={est.logo_url} alt="" className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{est.name}</p>
                    <p className="text-xs text-slate-500 capitalize">{est.type}</p>
                    {est.address && (
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <MapPin size={12} /> {est.address}
                      </p>
                    )}
                    {o !== null && (
                      <span className={`inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${o ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {o ? 'Ouvert' : 'Fermé'}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
