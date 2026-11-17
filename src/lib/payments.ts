/**
 * Paiements abonnement GESMAK — uniquement Wave + confirmation WhatsApp (activation manuelle admin)
 */
import { PLAN, priceForMonths, paymentWhatsAppLink, SUB_PERIODS } from '@/lib/subscription';

/** Numéro Wave (CI) affiché aux clients */
export const WAVE_NUMBER_DISPLAY = '05 02 01 20 11';
export const WAVE_NUMBER_RAW = '0502012011';

export function listPeriods() {
  return SUB_PERIODS.map((p) => ({
    ...p,
    amount: priceForMonths(p.months),
  }));
}

export function buildSubscriptionWhatsAppMessage(opts: {
  establishmentName: string;
  months: number;
  planLabel?: string;
  amount?: number;
  payerName?: string;
}): string {
  const amount = opts.amount ?? priceForMonths(opts.months);
  return [
    '*GESMAK — Confirmation paiement abonnement*',
    `Établissement : ${opts.establishmentName}`,
    opts.planLabel ? `Forfait : ${opts.planLabel}` : null,
    `Durée : ${opts.months} mois`,
    `Montant : ${amount.toLocaleString('fr-FR')} ${PLAN.currencyLabel}`,
    opts.payerName ? `Payé par : ${opts.payerName}` : null,
    '',
    `J'ai effectué le paiement Wave sur le ${WAVE_NUMBER_DISPLAY}.`,
    'Merci de vérifier et d’activer mon abonnement.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function openSubscriptionWhatsApp(opts: {
  establishmentName: string;
  months: number;
  planLabel?: string;
  amount?: number;
  payerName?: string;
}): void {
  const msg = buildSubscriptionWhatsAppMessage(opts);
  window.open(paymentWhatsAppLink(msg), '_blank', 'noopener,noreferrer');
}
