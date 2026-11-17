import { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export type AppAnnouncement = {
  id: string;
  title: string;
  body: string;
  link_url?: string | null;
  image_url?: string | null;
  active: boolean;
  sort_order: number;
};

export async function fetchActiveAnnouncements(): Promise<AppAnnouncement[]> {
  const { data } = await supabase
    .from('app_announcements')
    .select('id, title, body, link_url, image_url, active, sort_order')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  return (data || []) as AppAnnouncement[];
}

/** Publicités / infos — défilement vertical (texte + image) */
export default function AdMarquee({ className = '' }: { className?: string }) {
  const [items, setItems] = useState<AppAnnouncement[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      void fetchActiveAnnouncements().then((list) => {
        if (!cancelled) setItems(list);
      });
    load();
    const id = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (items.length === 0) return null;

  const parts = items
    .map((a) => {
      const text = a.title?.trim() ? `${a.title} — ${a.body}` : a.body;
      return {
        id: a.id,
        text: (text || '').trim(),
        href: a.link_url || null,
        image: a.image_url || null,
      };
    })
    .filter((p) => p.text || p.image);

  if (parts.length === 0) return null;

  const loop = [...parts, ...parts];
  const hasImages = parts.some((p) => p.image);

  return (
    <div
      className={`ad-marquee-wrap ad-marquee-vertical flex gap-2 overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-b from-amber-500/15 via-orange-500/10 to-amber-500/15 ${
        hasImages ? 'ad-marquee-with-img' : ''
      } ${className}`}
      role="marquee"
      aria-label="Annonces et publicités"
    >
      <span className="shrink-0 self-start pt-3 pl-3 text-amber-500">
        <Megaphone size={18} />
      </span>
      <div className={`ad-marquee-v-track flex-1 overflow-hidden ${hasImages ? 'ad-marquee-v-track-lg' : ''}`}>
        <div
          className="ad-marquee-v-scroll"
          style={{
            animationDuration: `${Math.max(10, parts.length * 6)}s`,
          }}
        >
          {loop.map((p, i) => (
            <div key={`${p.id}-${i}`} className={`ad-marquee-v-item text-sm font-medium text-stone-100 ${hasImages ? 'ad-marquee-v-item-lg' : ''}`}>
              {p.image && (
                <img
                  src={p.image}
                  alt=""
                  className="ad-marquee-img shrink-0 rounded-lg object-cover border border-stone-600/50"
                />
              )}
              <div className="min-w-0 flex-1">
                {p.href ? (
                  <a href={p.href} target="_blank" rel="noopener noreferrer" className="hover:underline text-amber-200">
                    {p.text || 'Voir'}
                  </a>
                ) : (
                  <span>{p.text}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
