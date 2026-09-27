import { useEffect, useRef, useState } from 'react';
import type { Establishment } from '@/lib/types';
import { MapPin, ExternalLink, Navigation } from 'lucide-react';

type Props = {
  establishments: Establishment[];
};

declare global {
  interface Window {
    L?: any;
  }
}

const LEAFLET_JS = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_CSS = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';

function loadLeaflet(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (window.L) {
      resolve(window.L);
      return;
    }
    const cssId = 'leaflet-css-cdn';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId;
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    const existing = document.querySelector('script[data-leaflet]') as HTMLScriptElement | null;
    if (existing) {
      if (window.L) {
        resolve(window.L);
        return;
      }
      existing.addEventListener('load', () => resolve(window.L));
      existing.addEventListener('error', () => reject(new Error('Impossible de charger la carte')));
      return;
    }
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.async = true;
    script.dataset.leaflet = '1';
    script.onload = () => {
      if (window.L) resolve(window.L);
      else reject(new Error('Leaflet chargé mais indisponible'));
    };
    script.onerror = () => reject(new Error('Impossible de charger la carte'));
    document.body.appendChild(script);
  });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function AdminEstablishmentsMap({ establishments }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  const withGps = establishments.filter(
    (e) =>
      e.latitude != null &&
      e.longitude != null &&
      !Number.isNaN(Number(e.latitude)) &&
      !Number.isNaN(Number(e.longitude)) &&
      (e as any).location_consent !== false,
  );
  const withoutGps = establishments.filter((e) => !withGps.includes(e));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      setReady(false);
      setUseFallback(false);
      try {
        const L = await loadLeaflet();
        if (cancelled || !mapRef.current) return;
        if (mapInstance.current) {
          mapInstance.current.remove();
          mapInstance.current = null;
        }
        const center: [number, number] =
          withGps.length > 0
            ? [Number(withGps[0].latitude), Number(withGps[0].longitude)]
            : [5.36, -4.008];
        const map = L.map(mapRef.current).setView(center, withGps.length ? 12 : 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap',
          maxZoom: 19,
        }).addTo(map);

        const bounds: [number, number][] = [];
        for (const e of withGps) {
          const lat = Number(e.latitude);
          const lng = Number(e.longitude);
          const marker = L.marker([lat, lng]).addTo(map);
          marker.bindPopup(
            `<strong>${escapeHtml(e.name || 'Établissement')}</strong><br/>` +
              `${lat.toFixed(5)}, ${lng.toFixed(5)}<br/>` +
              `<a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" rel="noopener">Ouvrir dans Maps</a>`,
          );
          bounds.push([lat, lng]);
        }
        if (bounds.length > 1) {
          map.fitBounds(bounds as any, { padding: [40, 40] });
        }
        mapInstance.current = map;
        setTimeout(() => map.invalidateSize(), 100);
        setReady(true);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Impossible de charger la carte');
          setUseFallback(true);
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
      if (mapInstance.current) {
        try {
          mapInstance.current.remove();
        } catch {
          /* */
        }
        mapInstance.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [establishments.map((e) => `${e.id}:${e.latitude}:${e.longitude}`).join('|')]);

  const fallbackCenter =
    withGps.length > 0
      ? { lat: Number(withGps[0].latitude), lng: Number(withGps[0].longitude) }
      : { lat: 5.36, lng: -4.008 };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          <MapPin size={14} /> {withGps.length} avec GPS
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-800 text-stone-400 border border-stone-700">
          {withoutGps.length} sans position
        </span>
        <p className="text-xs text-stone-500 w-full sm:w-auto">
          Positions GPS partagées par les propriétaires (consentement)
        </p>
      </div>

      {error && !useFallback && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
      )}

      <div
        ref={mapRef}
        className={`w-full h-72 sm:h-96 rounded-2xl border border-stone-800 overflow-hidden bg-stone-900 ${
          useFallback ? 'hidden' : ''
        }`}
      />

      {useFallback && (
        <div className="space-y-2">
          {error && (
            <p className="text-xs text-amber-400">
              Carte interactive indisponible ({error}). Affichage OpenStreetMap de secours.
            </p>
          )}
          <div className="w-full h-72 sm:h-96 rounded-2xl border border-stone-800 overflow-hidden">
            <iframe
              title="Carte établissements"
              className="w-full h-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${fallbackCenter.lng - 0.08}%2C${
                fallbackCenter.lat - 0.08
              }%2C${fallbackCenter.lng + 0.08}%2C${fallbackCenter.lat + 0.08}&layer=mapnik${
                withGps.length
                  ? `&marker=${fallbackCenter.lat}%2C${fallbackCenter.lng}`
                  : ''
              }`}
            />
          </div>
        </div>
      )}

      {!ready && !error && (
        <p className="text-sm text-stone-500">Chargement de la carte…</p>
      )}

      <div className="space-y-2">
        {withGps.map((e) => {
          const lat = Number(e.latitude);
          const lng = Number(e.longitude);
          return (
            <div
              key={e.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-stone-800 bg-stone-900/50 px-3 py-2"
            >
              <div>
                <p className="font-medium text-stone-100 text-sm">{e.name}</p>
                <p className="text-xs text-stone-500">
                  {lat.toFixed(5)}, {lng.toFixed(5)}
                  {e.location_updated_at && (
                    <span>
                      {' '}
                      · {new Date(e.location_updated_at).toLocaleString('fr-FR')}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <a
                  className="btn-secondary text-xs inline-flex items-center gap-1"
                  href={`https://www.google.com/maps?q=${lat},${lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Navigation size={14} /> Maps
                </a>
                <a
                  className="btn-ghost text-xs inline-flex items-center gap-1"
                  href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink size={14} /> OSM
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {withoutGps.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-stone-400">Sans GPS ({withoutGps.length})</h3>
          <div className="grid gap-1 sm:grid-cols-2">
            {withoutGps.map((e) => (
              <div
                key={e.id}
                className="text-xs text-stone-500 px-2 py-1.5 rounded-lg bg-stone-900/60 border border-stone-800"
              >
                {e.name}
                {e.address ? ` — ${e.address}` : ''}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
