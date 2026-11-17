/**
 * Cartes gratuites — OpenStreetMap + Nominatim (géocodage)
 * Politique d’usage : https://operations.osmfoundation.org/policies/nominatim/
 * 1 req/s max, User-Agent identifié obligatoire.
 */

export type GeoPoint = { lat: number; lng: number; label?: string };

const NOMINATIM = 'https://nominatim.openstreetmap.org';

/** GPS navigateur */
export function getCurrentPosition(timeoutMs = 12000): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Géolocalisation non supportée'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}

/** Inverse géocode (lat/lng → adresse) via Nominatim gratuit */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const url = `${NOMINATIM}/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'StockManagerAI/1.0 (contact: mafi.russ123@gmail.com)',
    },
  });
  if (!res.ok) throw new Error('Nominatim indisponible');
  const data = (await res.json()) as { display_name?: string };
  return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/** Recherche d’adresse (Côte d’Ivoire par défaut) */
export async function searchAddress(query: string, country = 'ci'): Promise<GeoPoint[]> {
  const q = encodeURIComponent(query.trim());
  if (!q) return [];
  const url = `${NOMINATIM}/search?format=json&q=${q}&countrycodes=${country}&limit=5`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'StockManagerAI/1.0 (contact: mafi.russ123@gmail.com)',
    },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  return data.map((r) => ({
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    label: r.display_name,
  }));
}

/** Lien carte OpenStreetMap (sans clé API) */
export function osmMapLink(lat: number, lng: number, zoom = 16): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
}

/** Lien itinéraire OSM */
export function osmDirectionsLink(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/directions?to=${lat}%2C${lng}`;
}
