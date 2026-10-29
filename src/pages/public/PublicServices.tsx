import { useEffect, useState } from 'react';
import { Camera, Music, PartyPopper, Utensils, Truck, Home, Loader2, Phone } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import PublicLayout from '@/components/public/PublicLayout';
import AuthModal, { AuthMode } from '@/components/public/AuthModal';

const CATS = [
  { icon: Utensils, title: 'Traiteur', key: 'traiteur' },
  { icon: Music, title: 'DJ', key: 'dj' },
  { icon: Camera, title: 'Photo / Vidéo', key: 'photo' },
  { icon: PartyPopper, title: 'Décoration', key: 'deco' },
  { icon: Truck, title: 'Location matériel', key: 'location' },
  { icon: Home, title: 'Autre', key: 'autre' },
];

type Provider = {
  id: string;
  full_name: string;
  category: string;
  description: string | null;
  phone: string | null;
  city: string | null;
  photo_url: string | null;
};

export default function PublicServices() {
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [list, setList] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [cat, setCat] = useState('traiteur');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Services · GESMAK';
    (async () => {
      const { data } = await supabase
        .from('service_providers')
        .select('id, full_name, category, description, phone, city, photo_url')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(60);
      setList((data as Provider[]) || []);
      setLoading(false);
    })();
  }, []);

  return (
    <PublicLayout onOpenAuth={user ? undefined : (m) => { setAuthMode(m); setAuthOpen(true); }}>
      <AuthModal open={authOpen} mode={authMode} onClose={() => setAuthOpen(false)} onMode={setAuthMode} />
      <div className="max-w-6xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold">Services</h1>
        <p className="text-sm text-slate-500 mt-1">Prestataires pour vos événements et établissements</p>

        <div className="mt-6 grid sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {CATS.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.key} className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                <Icon size={18} className="mx-auto text-blue-600" />
                <p className="text-xs font-medium mt-1">{s.title}</p>
              </div>
            );
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-blue-600" /></div>
        ) : list.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            Aucun prestataire publié. Soyez le premier.
          </div>
        ) : (
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((p) => (
              <article key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="font-semibold">{p.full_name}</p>
                <p className="text-xs text-blue-600 capitalize mt-0.5">{p.category}</p>
                {p.city && <p className="text-xs text-slate-500 mt-1">{p.city}</p>}
                {p.description && <p className="text-sm text-slate-600 mt-2 line-clamp-3">{p.description}</p>}
                {p.phone && (
                  <a href={`tel:${p.phone}`} className="inline-flex items-center gap-1 mt-3 text-sm font-semibold text-emerald-700">
                    <Phone size={14} /> {p.phone}
                  </a>
                )}
              </article>
            ))}
          </div>
        )}

        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-5 max-w-lg">
          <h2 className="font-bold text-slate-900">Proposer mes services</h2>
          <p className="text-xs text-slate-500 mt-1">Visible sur la plateforme (sans données de stock).</p>
          <div className="mt-3 space-y-2">
            <input className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="Nom / structure" value={name} onChange={(e) => setName(e.target.value)} />
            <select className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm" value={cat} onChange={(e) => setCat(e.target.value)}>
              {CATS.map((c) => (
                <option key={c.key} value={c.key}>{c.title}</option>
              ))}
            </select>
            <input className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="Ville (ex. Abidjan)" value={city} onChange={(e) => setCity(e.target.value)} />
            <input className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="Téléphone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[70px]" placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
            <button
              type="button"
              disabled={busy || !name.trim()}
              className="h-10 px-4 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50"
              onClick={async () => {
                setBusy(true);
                setMsg(null);
                const { error } = await supabase.from('service_providers').insert({
                  user_id: user?.id || null,
                  full_name: name.trim(),
                  category: cat,
                  city: city.trim() || null,
                  phone: phone.trim() || null,
                  description: desc.trim() || null,
                  is_published: true,
                });
                if (error) {
                  setMsg(
                    error.message.includes('service_providers')
                      ? 'Table prestataires absente — appliquez la migration SQL fournie.'
                      : error.message
                  );
                } else {
                  setMsg('Profil publié.');
                  setList((l) => [
                    {
                      id: crypto.randomUUID(),
                      full_name: name.trim(),
                      category: cat,
                      description: desc.trim() || null,
                      phone: phone.trim() || null,
                      city: city.trim() || null,
                      photo_url: null,
                    },
                    ...l,
                  ]);
                  setName('');
                  setDesc('');
                }
                setBusy(false);
              }}
            >
              Publier
            </button>
            {msg && <p className="text-xs text-slate-500">{msg}</p>}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
