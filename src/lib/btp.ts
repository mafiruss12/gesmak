export type BtpDocType = 'quote' | 'invoice' | 'situation';
export type BtpDocStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'paid' | 'partial' | 'overdue';

export const BTP_CATEGORIES = [
  { id: 'gros_oeuvre', label: 'Gros œuvre' },
  { id: 'maconnerie', label: 'Maçonnerie' },
  { id: 'charpente_couverture', label: 'Charpente / Couverture' },
  { id: 'plomberie_sanitaire', label: 'Plomberie / Sanitaire' },
  { id: 'electricite', label: 'Électricité' },
  { id: 'peinture_revetement', label: 'Peinture / Revêtement' },
  { id: 'carrelage', label: 'Carrelage' },
  { id: 'menuiserie', label: 'Menuiserie' },
  { id: 'quincaillerie_fer', label: 'Quincaillerie / Fer' },
  { id: 'main_oeuvre', label: 'Main d\'œuvre' },
  { id: 'engins_location', label: 'Engins / Location' },
  { id: 'divers', label: 'Divers' },
] as const;

export const DOC_TYPE_LABELS: Record<BtpDocType, string> = {
  quote: 'Devis',
  invoice: 'Facture',
  situation: 'Situation',
};

export const DOC_STATUS_LABELS: Record<BtpDocStatus, string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  accepted: 'Accepté',
  rejected: 'Refusé',
  paid: 'Payé',
  partial: 'Acompte',
  overdue: 'En retard',
};

export function formatMoney(n: number, currency = 'FCFA') {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} ${currency}`;
}

/** Affiche vide si 0 / non renseigné (saisie utilisateur) */
export function formatMoneyOrEmpty(n: number | null | undefined | '', currency = 'FCFA') {
  if (n === '' || n === null || n === undefined) return '';
  const v = Number(n);
  if (!v || Number.isNaN(v)) return '';
  return `${Math.round(v).toLocaleString('fr-FR')} ${currency}`;
}

export function parseOptionalNumber(v: string | number | null | undefined): number {
  if (v === '' || v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** Icône emoji matériel selon désignation / catégorie */
export function materialIcon(name: string, category?: string): string {
  const t = `${name} ${category || ''}`.toLowerCase();
  if (/ciment|beton|béton|sable|gravier|parpaing|brique/.test(t)) return '🧱';
  if (/fer|acier|barre|ferraille|nail|clou/.test(t)) return '🔩';
  if (/bois|charpente|planche|contreplaqu/.test(t)) return '🪵';
  if (/peinture|enduit|vernis/.test(t)) return '🎨';
  if (/cable|câble|electri|électri|prise|disjonct/.test(t)) return '⚡';
  if (/tuyau|plomber|robinet|sanitaire|pvc/.test(t)) return '🔧';
  if (/carrel|faience|faïence|dalle/.test(t)) return '⬜';
  if (/main.?d.?oeuvre|main d|ouvrier|maçon|macon/.test(t)) return '👷';
  if (/engin|camion|location|grue/.test(t)) return '🚜';
  if (/porte|fenetre|fenêtre|menuiser/.test(t)) return '🚪';
  if (/toiture|tole|tôle|couvertur/.test(t)) return '🏠';
  if (/eau|pompe/.test(t)) return '💧';
  return '📦';
}


export function lineHT(qty: number, price: number, discount = 0) {
  const base = Number(qty) * Number(price);
  return base * (1 - Number(discount) / 100);
}

export function nextDocNumber(type: BtpDocType, existing: { type: string; doc_number: string }[]) {
  const prefix = type === 'quote' ? 'DEV' : type === 'invoice' ? 'FAC' : 'SIT';
  const year = new Date().getFullYear();
  const same = existing.filter((d) => d.type === type && d.doc_number.includes(String(year)));
  const n = same.length + 1;
  return `${prefix}-${year}-${String(n).padStart(4, '0')}`;
}

export type BtpBranding = {
  slogan?: string;
  activity?: string;
  email?: string;
  website?: string;
  city?: string;
  country?: string;
  rccm?: string;
  nif?: string;
  tva_number?: string;
  bank_name?: string;
  iban?: string;
  mobile_money?: string;
  header_note?: string;
  footer_text?: string;
  legal_notice?: string;
  payment_terms_default?: string;
  stamp_url?: string;
};

export const DEFAULT_BRANDING: BtpBranding = {
  slogan: '',
  activity: 'Travaux de bâtiment & fournitures',
  email: '',
  website: '',
  city: '',
  country: 'Côte d\'Ivoire',
  rccm: '',
  nif: '',
  tva_number: '',
  bank_name: '',
  iban: '',
  mobile_money: '',
  header_note: '',
  footer_text: 'Merci de votre confiance.',
  legal_notice: 'Devis valable 30 jours. Acompte à la commande.',
  payment_terms_default: 'Acompte 30 % à la commande, solde à la réception des travaux.',
  stamp_url: '',
};
