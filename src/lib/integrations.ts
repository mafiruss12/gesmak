import { toWhatsAppNumber } from '@/lib/login';
/**
 * Intégrations P3 — WhatsApp & Mobile Money
 * Sans clés API : liens wa.me + méthodes de paiement locales.
 * Pour une vraie API (Orange/MTN/Wave/WhatsApp Cloud), brancher les secrets côté serveur.
 */

export type MobileMoneyProvider = 'orange_money' | 'mtn_money' | 'moov_money' | 'wave' | 'cash' | 'card' | 'ardoise';

export const MOBILE_MONEY_LABELS: Record<MobileMoneyProvider, string> = {
  orange_money: 'Orange Money',
  mtn_money: 'MTN Money',
  moov_money: 'Moov Money',
  wave: 'Wave',
  cash: 'Espèces',
  card: 'Carte',
  ardoise: 'Ardoise (crédit)',
};

export const MOBILE_MONEY_PROVIDERS: MobileMoneyProvider[] = [
  'cash',
  'wave',
  'orange_money',
  'mtn_money',
  'moov_money',
  'card',
  'ardoise',
];

/** Ouvre WhatsApp avec un message prérempli — format wa.me/225XXXXXXXXX */
export function openWhatsApp(phone: string, message: string): void {
  const digits = toWhatsAppNumber(phone);
  if (!digits) return;
  // Format imposé : wa.me/225XXXXXXXXX (Côte d'Ivoire)
  const url = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = toWhatsAppNumber(phone);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function buildInvoiceWhatsAppMessage(opts: {
  businessName: string;
  clientName?: string;
  amount: number;
  reference?: string;
  note?: string;
}): string {
  const lines = [
    `*${opts.businessName}* — GESMAK`,
    opts.clientName ? `Client : ${opts.clientName}` : null,
    opts.reference ? `Réf. : ${opts.reference}` : null,
    `Montant : ${opts.amount.toLocaleString('fr-FR')} FCFA`,
    opts.note || null,
    '',
    'Merci pour votre confiance.',
    'App créée par Kevin Akoh de Kevin Tech Pro',
  ].filter(Boolean);
  return lines.join('\n');
}

/**
 * Checklist pour brancher les vraies API (à faire par le propriétaire) :
 * - WhatsApp Cloud API : Meta Business + token + phone_number_id
 * - Orange Money / MTN MoMo / Wave : comptes marchands + clés API + webhook HTTPS
 * Ne jamais mettre les secrets dans le frontend.
 */
export const INTEGRATION_CHECKLIST = [
  'Créer un compte Meta Business et WhatsApp Cloud API',
  'Créer un compte marchand Orange Money / MTN / Wave',
  'Configurer les webhooks sur une URL HTTPS (Vercel serverless)',
  'Stocker les secrets uniquement dans Vercel Environment Variables',
] as const;
