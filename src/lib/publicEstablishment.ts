/** Helpers vitrine publique — sans exposer données financières */

export type DayHours = { open?: string; close?: string; closed?: boolean };
export type OpeningHours = {
  mon?: DayHours;
  tue?: DayHours;
  wed?: DayHours;
  thu?: DayHours;
  fri?: DayHours;
  sat?: DayHours;
  sun?: DayHours;
};

export const DAY_LABELS: { key: keyof OpeningHours; label: string }[] = [
  { key: 'mon', label: 'Lundi' },
  { key: 'tue', label: 'Mardi' },
  { key: 'wed', label: 'Mercredi' },
  { key: 'thu', label: 'Jeudi' },
  { key: 'fri', label: 'Vendredi' },
  { key: 'sat', label: 'Samedi' },
  { key: 'sun', label: 'Dimanche' },
];

const DAY_BY_JS: (keyof OpeningHours)[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function slugify(name: string, id?: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  const short = (id || '').replace(/-/g, '').slice(0, 6);
  return short ? `${base || 'etablissement'}-${short}` : base || 'etablissement';
}

export function isOpenNow(hours: OpeningHours | null | undefined, now = new Date()): boolean | null {
  if (!hours || typeof hours !== 'object' || Object.keys(hours).length === 0) return null;
  const key = DAY_BY_JS[now.getDay()];
  const slot = hours[key];
  if (!slot) return null;
  if (slot.closed) return false;
  if (!slot.open || !slot.close) return null;
  const [oh, om] = slot.open.split(':').map(Number);
  const [ch, cm] = slot.close.split(':').map(Number);
  const mins = now.getHours() * 60 + now.getMinutes();
  const o = oh * 60 + (om || 0);
  let c = ch * 60 + (cm || 0);
  if (c <= o) c += 24 * 60;
  let m = mins;
  if (c >= 24 * 60 && m < o) m += 24 * 60;
  return m >= o && m <= c;
}

export function waLink(phone: string | null | undefined, text?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return null;
  const n = digits.startsWith('225')
    ? digits
    : digits.startsWith('0')
      ? `225${digits.slice(1)}`
      : `225${digits}`;
  const q = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${n}${q}`;
}

const FAV_KEY = 'sm_fav_establishments';

export function getFavoriteIds(): string[] {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

export function toggleFavorite(estId: string): string[] {
  const set = new Set(getFavoriteIds());
  if (set.has(estId)) set.delete(estId);
  else set.add(estId);
  const next = [...set];
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(next));
  } catch {
    /* */
  }
  return next;
}

export function isFavorite(estId: string): boolean {
  return getFavoriteIds().includes(estId);
}
