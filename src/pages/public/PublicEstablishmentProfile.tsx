import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Loader2, MapPin, Phone, Star, Clock, ChevronLeft, MessageCircle, Navigation
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatFCFA } from '@/lib/format';
import PublicLayout from '@/components/public/PublicLayout';
import AuthModal, { AuthMode } from '@/components/public/AuthModal';
import { useAuth } from '@/lib/auth';
import {
  isOpenNow, waLink, type OpeningHours, toggleFavorite, isFavorite, DAY_LABELS,
} from '@/lib/publicEstablishment';

type Est = {
  id: string;
  name: string;
  type: string | null;
  address: string | null;
  phone: string | null;
  logo_url?: string | null;
  cover_url?: string | null;
  description?: string | null;
  public_menu?: boolean;
  slug?: string | null;
  opening_hours?: OpeningHours | null;
  public_show_stock?: boolean | null;
  public_rating?: number | null;
  public_reviews_count?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  gallery_urls?: string[] | null;
};

type Prod = {
  id: string;
  name: string;
  category: string | null;
  price: number;
  stock: number;
  image_url?: string | null;
};

export default function PublicEstablishmentProfile() {
  const { slugOrId } = useParams<{ slugOrId: string }>();
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [est, setEst] = useState<Est | null>(null);
  const [products, setProducts] = useState<Prod[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fav, setFav] = useState(false);
  const [reviews, setReviews] = useState<{ id: string; author_name: string | null; rating: number; comment: string | null; created_at: string }[]>([]);
  const [revRating, setRevRating] = useState(5);
  const [revComment, setRevComment] = useState('');
  const [revName, setRevName] = useState('');
  const [revBusy, setRevBusy] = useState(false);
  const [revMsg, setRevMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!slugOrId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      // by id or slug
      let row: Est | null = null;
      const byId = await supabase
        .from('establishments')
        .select('id, name, type, address, phone, logo_url, cover_url, description, public_menu, slug, opening_hours, public_show_stock, public_rating, public_reviews_count, latitude, longitude, gallery_urls')
        .eq('id', slugOrId)
        .maybeSingle();
      if (byId.data) row = byId.data as Est;
      if (!row) {
        const bySlug = await supabase
          .from('establishments')
          .select('id, name, type, address, phone, logo_url, cover_url, description, public_menu, slug, opening_hours, public_show_stock, public_rating, public_reviews_count, latitude, longitude, gallery_urls')
          .eq('slug', slugOrId)
          .maybeSingle();
        if (bySlug.data) row = bySlug.data as Est;
      }
      // fallback: scan public_menu list if slug is generated client-side
      if (!row) {
        const { data: list } = await supabase
          .from('establishments')
          .select('id, name, type, address, phone, logo_url, cover_url, description, public_menu, slug, opening_hours, public_show_stock, public_rating, public_reviews_count, latitude, longitude, gallery_urls')
          .eq('public_menu', true)
          .limit(80);
        row = ((list as Est[]) || []).find((e) => slugify(e.name, e.id) === slugOrId || e.id === slugOrId) || null;
      }
      if (cancelled) return;
      if (!row || !row.public_menu) {
        setError('Établissement introuvable ou vitrine non publique.');
        setLoading(false);
        return;
      }
      setEst(row);
      setFav(isFavorite(row.id));
      void supabase.rpc('bump_public_stat', { p_est: row.id, p_kind: 'profile' });
      const [pRes, evRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, category, price, stock, image_url')
          .eq('establishment_id', row.id)
          .order('category')
          .order('name'),
        supabase
          .from('public_events')
          .select('*')
          .eq('establishment_id', row.id)
          .eq('is_published', true)
          .gte('starts_at', new Date(Date.now() - 86400000).toISOString())
          .order('starts_at')
          .limit(10),
      ]);
      if (cancelled) return;
      setProducts((pRes.data as Prod[]) || []);
      setEvents(evRes.data || []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slugOrId]);

  const open = useMemo(() => isOpenNow(est?.opening_hours || null), [est]);
  const wa = waLink(est?.phone, `Bonjour, je vous contacte via GESMAK (${est?.name || ''})`);

  const maps =
    est?.latitude && est?.longitude
      ? `https://www.google.com/maps?q=${est.latitude},${est.longitude}`
      : est?.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(est.address)}`
        : null;

  return (
    <PublicLayout onOpenAuth={user ? undefined : (m) => { setAuthMode(m); setAuthOpen(true); }}>
      <AuthModal open={authOpen} mode={authMode} onClose={() => setAuthOpen(false)} onMode={setAuthMode} />

      {loading ? (
        <div className="flex justify-center py-24"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
      ) : error || !est ? (
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <p className="font-semibold text-slate-800">{error || 'Introuvable'}</p>
          <Link to="/establishments" className="inline-flex mt-4 text-blue-600 font-semibold text-sm">
            ← Retour aux établissements
          </Link>
        </div>
      ) : (
        <div>
          <div className="relative h-48 sm:h-64 bg-slate-300">
            {est.cover_url || est.logo_url ? (
              <img src={est.cover_url || est.logo_url || ''} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-slate-700 to-blue-900" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <Link to="/establishments" className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
              <ChevronLeft size={20} />
            </Link>
          </div>

          <div className="max-w-3xl mx-auto px-4 -mt-12 relative z-10 pb-16">
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-5">
              <div className="flex gap-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 overflow-hidden border-2 border-white shadow shrink-0 -mt-10">
                  {est.logo_url ? (
                    <img src={est.logo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-blue-600 text-white flex items-center justify-center font-bold">
                      {est.name.slice(0, 1)}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 pt-1">
                  <h1 className="text-xl font-bold text-slate-900">{est.name}</h1>
                  <p className="text-sm text-slate-500 capitalize">{est.type || 'Établissement'}</p>
                  <div className="flex flex-wrap gap-2 mt-2 text-xs">
                    {open === true && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">Ouvert</span>
                    )}
                    {open === false && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">Fermé</span>
                    )}
                    {est.public_rating != null && (
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <Star size={12} className="text-amber-500" /> {Number(est.public_rating).toFixed(1)}
                        {est.public_reviews_count ? ` (${est.public_reviews_count})` : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {est.description && (
                <p className="mt-4 text-sm text-slate-600 leading-relaxed">{est.description}</p>
              )}
              {Array.isArray(est.gallery_urls) && est.gallery_urls.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {est.gallery_urls.slice(0, 6).map((u, i) => (
                    <img key={i} src={u} alt="" className="w-full h-24 object-cover rounded-xl border border-slate-200" loading="lazy" />
                  ))}
                </div>
              )}
              {est.address && (
                <p className="mt-3 text-sm text-slate-500 flex items-center gap-1.5">
                  <MapPin size={14} /> {est.address}
                </p>
              )}

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Link
                  to={`/m/${est.id}`}
                  onClick={() => void supabase.rpc('bump_public_stat', { p_est: est.id, p_kind: 'menu' })}
                  className="h-10 rounded-xl bg-blue-600 text-white text-xs font-semibold flex items-center justify-center hover:bg-blue-700"
                >
                  Voir le menu
                </Link>
                {wa && (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => void supabase.rpc('bump_public_stat', { p_est: est.id, p_kind: 'whatsapp' })}
                    className="h-10 rounded-xl bg-emerald-600 text-white text-xs font-semibold flex items-center justify-center gap-1 hover:bg-emerald-700"
                  >
                    <MessageCircle size={14} /> WhatsApp
                  </a>
                )}
                {est.phone && (
                  <a
                    href={`tel:${est.phone}`}
                    onClick={() => void supabase.rpc('bump_public_stat', { p_est: est.id, p_kind: 'phone' })}
                    className="h-10 rounded-xl bg-slate-100 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1"
                  >
                    <Phone size={14} /> Appeler
                  </a>
                )}
                {maps && (
                  <a href={maps} target="_blank" rel="noreferrer" className="h-10 rounded-xl bg-slate-100 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1">
                    <Navigation size={14} /> Itinéraire
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setFav(toggleFavorite(est.id).includes(est.id))}
                  className={`h-10 rounded-xl text-xs font-semibold ${fav ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'}`}
                >
                  {fav ? '★ Favori' : '☆ Favori'}
                </button>
              </div>

              {est.opening_hours && Object.keys(est.opening_hours).length > 0 && (
                <div className="mt-4 rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <p className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1"><Clock size={12} /> Horaires</p>
                  <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600">
                    {DAY_LABELS.map(({ key, label }) => {
                      const s = (est.opening_hours as OpeningHours)?.[key];
                      const txt = !s ? '—' : s.closed ? 'Fermé' : `${s.open || '?'} – ${s.close || '?'}`;
                      return (
                        <div key={key} className="flex justify-between gap-2">
                          <span>{label}</span>
                          <span className="font-medium">{txt}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <section className="mt-8">
              <h2 className="font-bold text-slate-900 mb-3">Menu & disponibilités</h2>
              {products.length === 0 ? (
                <p className="text-sm text-slate-500">Menu non renseigné.</p>
              ) : (
                <div className="space-y-2">
                  {products.map((p) => {
                    const showStock = est.public_show_stock !== false;
                    const avail = Number(p.stock) > 0;
                    return (
                      <div key={p.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm">{p.name}</p>
                          {p.category && <p className="text-[11px] text-slate-400">{p.category}</p>}
                        </div>
                        <p className="text-sm font-bold">{formatFCFA(Number(p.price))}</p>
                        {showStock && (
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${avail ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                            {avail ? `${p.stock} dispo` : 'Épuisé'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {events.length > 0 && (
              <section className="mt-8">
                <h2 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Clock size={18} /> Événements
                </h2>
                <div className="space-y-3">
                  {events.map((ev) => (
                    <div key={ev.id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="font-semibold">{ev.title}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(ev.starts_at).toLocaleString('fr-FR')}
                        {ev.venue ? ` · ${ev.venue}` : ''}
                      </p>
                      {ev.description && <p className="text-sm text-slate-600 mt-2">{ev.description}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="mt-8">
              <h2 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Star size={18} className="text-amber-500" /> Avis
              </h2>
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 mb-4">
                <p className="text-sm font-medium text-slate-800">Laisser un avis</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setRevRating(n)} className={n <= revRating ? 'text-amber-500' : 'text-slate-300'}>
                      <Star size={20} fill={n <= revRating ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>
                <input className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="Votre nom" value={revName} onChange={(e) => setRevName(e.target.value)} />
                <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[70px]" placeholder="Commentaire (optionnel)" value={revComment} onChange={(e) => setRevComment(e.target.value)} />
                <button
                  type="button"
                  disabled={revBusy || !revName.trim()}
                  className="h-10 px-4 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50"
                  onClick={async () => {
                    if (!est) return;
                    setRevBusy(true);
                    setRevMsg(null);
                    const { error: err } = await supabase.from('public_reviews').insert({
                      establishment_id: est.id,
                      user_id: user?.id || null,
                      author_name: revName.trim(),
                      rating: revRating,
                      comment: revComment.trim() || null,
                      is_visible: true,
                    });
                    if (err) setRevMsg(err.message.includes('policy') ? 'Connectez-vous ou réessayez plus tard.' : err.message);
                    else {
                      setRevMsg('Merci pour votre avis !');
                      setReviews((r) => [
                        { id: crypto.randomUUID(), author_name: revName.trim(), rating: revRating, comment: revComment.trim() || null, created_at: new Date().toISOString() },
                        ...r,
                      ]);
                      setRevComment('');
                    }
                    setRevBusy(false);
                  }}
                >
                  Envoyer
                </button>
                {revMsg && <p className="text-xs text-slate-500">{revMsg}</p>}
              </div>
              {reviews.length === 0 ? (
                <p className="text-sm text-slate-500">Pas encore d&apos;avis.</p>
              ) : (
                <div className="space-y-2">
                  {reviews.map((r) => (
                    <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm">{r.author_name || 'Anonyme'}</p>
                        <span className="text-xs text-amber-600">{'★'.repeat(r.rating)}</span>
                      </div>
                      {r.comment && <p className="text-sm text-slate-600 mt-1">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </PublicLayout>
  );
}
