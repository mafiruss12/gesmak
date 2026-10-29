/**
 * Identifiants GESMAK
 * - E-mail réel (contient @ et un domaine public) → utilisé tel quel (reset MDP possible)
 * - Téléphone / pseudo → transformé en compte interne …@maquis.local (pas de mail réel)
 */
/** Domaine interne pour les identifiants simples (sans email réel) */
export const LOGIN_DOMAIN = 'maquis.local';

/**
 * Normalise un numéro CI vers 10 chiffres locaux (0XXXXXXXXX) ou null.
 */
export function normalizeCiPhone(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('225') && digits.length >= 12) digits = digits.slice(3);
  if (digits.length === 10 && digits.startsWith('0')) return digits;
  if (digits.length === 9) return `0${digits}`;
  if (digits.length === 10) return digits.startsWith('0') ? digits : null;
  return null;
}


/** Format international sans + pour wa.me → 225XXXXXXXXX */
export function toWhatsAppNumber(phone: string): string {
  let d = phone.replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('225')) return d.length >= 13 ? d.slice(0, 13) : d;
  if (d.startsWith('0') && d.length === 10) return `225${d.slice(1)}`;
  if (d.length === 9) return `225${d}`;
  return `225${d.replace(/^0+/, '')}`;
}


/**
 * Convertit un identifiant libre en email Supabase.
 * - "jean@gmail.com" → inchangé
 * - "0708091011" / "+225 07 08 09 10 11" → "0708091011@maquis.local"
 * - "gerant1" → "gerant1@maquis.local"
 */
export function toAuthEmail(login: string): string {
  const v = login.trim().toLowerCase();
  if (!v) return v;
  if (v.includes('@')) return v;
  const phone = normalizeCiPhone(v);
  if (phone) return `${phone}@${LOGIN_DOMAIN}`;
  const clean = v.replace(/[^a-z0-9._-]/g, '');
  return `${clean}@${LOGIN_DOMAIN}`;
}

/** Affiche un login lisible à partir de l'email stocké */
export function displayLogin(email: string | null | undefined): string {
  if (!email) return '—';
  if (email.endsWith(`@${LOGIN_DOMAIN}`)) return email.replace(`@${LOGIN_DOMAIN}`, '');
  return email;
}

/** Génère un mot de passe simple à communiquer (8 caractères) */
export function generatePassword(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) out += chars[arr[i] % chars.length];
  return out;
}

/** Génère un identifiant simple à partir du nom */
export function generateLogin(fullName: string, role: string): string {
  const base = (fullName || role || 'user')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 10) || 'user';
  const suffix = Math.floor(100 + Math.random() * 900);
  return `${base}${suffix}`;
}
