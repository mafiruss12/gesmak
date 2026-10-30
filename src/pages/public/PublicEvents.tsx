import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Calendar, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import PublicLayout from '@/components/public/PublicLayout';
import AuthModal, { AuthMode } from '@/components/public/AuthModal';
import { slugify } from '@/lib/publicEstablishment';

type Item = {
  id: string;
  title: string;
  body: string;
  when?: string;
  venue?: string;
  image_url?: string | null;
  est_id?: string;
  est_name?: string;
  link?: string;
};

export default function PublicEvents() {
  useEffect(() => { document.title = 'Événements · GESMAK'; }, []);
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [ann, ev] = await Promise.all([
        supabase.from('app_announcements').select('id, title, body, link_url, image_url').eq('active', true).order('sort_order'),
        supabase
          .from('public_events')
          .select('id, title, description, image_url, venue, starts_at, price_label, artist, establishment_id, establishments(name)')
          .eq('is_published', true)
          .gte('starts_at', new Date(Date.now() - 3600000).toISOString())
          .order('starts_at')
          .limit(40),
      ]);
      const list: Item[] = [];
      for (const a of ann.data || []) {
        list.push({
          id: `a-${a.id}`,
          title: a.title,
          body: a.body,
          image_url: a.image_url,
          link: a.link_url || undefined,
        });
      }
      for (const e of ev.data || []) {
        const estName = (e as any).establishments?.name;
        list.push({
          id: `e-${e.id}`,
          title: e.title,
          body: e.description || '',
          when: new Date(e.starts_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }),
          venue: e.venue || undefined,
          image_url: e.image_url,
          est_id: e.establishment_id,
          est_name: estName,
        });
      }
      setItems(list);
      setLoading(false);
    })();
  }, []);

  return (
    <PublicLayout onOpenAuth={user ? undefined : (m) => { setAuthMode(m); setAuthOpen(true); }}>
      <AuthModal open={authOpen} mode={authMode} onClose={() => setAuthOpen(false)} onMode={setAuthMode} />
      <div className="max-w-6xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Calendar className="text-blue-600" size={22} /> Événements</h1>
        <p className="text-sm text-slate-500 mt-1">Soirées, promos et temps forts des établissements</p>
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" /></div>
        ) : items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500 text-sm">
            Aucun événement publié pour le moment.
          </div>
        ) : (
          <div className="mt-6 grid sm:grid-cols-2 gap-4">
            {items.map((a) => (
              <article key={a.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                {a.image_url && <img src={a.image_url} alt="" className="w-full h-44 object-cover" loading="lazy" />}
                <div className="p-4">
                  <p className="font-bold text-slate-900">{a.title}</p>
                  {a.when && <p className="text-xs text-blue-700 font-medium mt-1">{a.when}</p>}
                  {(a.venue || a.est_name) && (
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <MapPin size={12} /> {[a.est_name, a.venue].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {a.body && <p className="text-sm text-slate-600 mt-2 line-clamp-4 whitespace-pre-wrap">{a.body}</p>}
                  {a.est_id && a.est_name && (
                    <Link to={`/e/${slugify(a.est_name, a.est_id)}`} className="inline-block mt-3 text-sm font-semibold text-blue-600">
                      Voir l&apos;établissement
                    </Link>
                  )}
                  {a.link && (
                    <a href={a.link} className="inline-block mt-3 text-sm font-semibold text-blue-600 ml-3">Découvrir</a>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
