/**
 * Paiements abonnement Stock Manager — Paystack (principal) + WhatsApp (manuel)
 */
import { PLAN, priceForMonths, paymentWhatsAppLink, SUB_PERIODS, type PlanTier } from '@/lib/subscription';

export type PaymentProvider = 'whatsapp' | 'paystack';

/** Moyens pour la demande manuelle WhatsApp uniquement */
export const PAYMENT_METHODS = [
  { id: 'whatsapp' as const, label: 'WhatsApp (validation manuelle)', icon: '💬' },
  { id: 'mobile_money' as const, label: 'Mobile Money (via WhatsApp)', icon: '📱' },
];

export function isPaystackConfigured(): boolean {
  return import.meta.env.VITE_PAYSTACK_DISABLED !== '1';
}

export function buildSubscriptionWhatsAppMessage(opts: {
  establishmentName: string;
  months: number;
  method?: string;
  planLabel?: string;
}): string {
  const amount = priceForMonths(opts.months);
  return [
    '*Stock Manager AI — Paiement abonnement*',
    `Établissement : ${opts.establishmentName}`,
    opts.planLabel ? `Forfait : ${opts.planLabel}` : null,
    `Durée : ${opts.months} mois`,
    `Montant : ${amount.toLocaleString('fr-FR')} ${PLAN.currencyLabel}`,
    opts.method ? `Moyen souhaité : ${opts.method}` : null,
    '',
    'Je confirme le paiement. Merci d’activer mon abonnement après réception.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function openSubscriptionWhatsApp(opts: {
  establishmentName: string;
  months: number;
  method?: string;
  planLabel?: string;
}): void {
  const msg = buildSubscriptionWhatsAppMessage(opts);
  const url = paymentWhatsAppLink(msg);
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function listPeriods() {
  return SUB_PERIODS.map((p) => ({
    ...p,
    amount: priceForMonths(p.months),
  }));
}

/**
 * Init Paystack via API serveur (secret key jamais exposée)
 */
export async function initPaystackCheckout(opts: {
  amount: number;
  email: string;
  reference?: string;
  description: string;
  callback_url?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ authorization_url?: string; reference?: string; error?: string }> {
  try {
    const res = await fetch('/api/paystack/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: opts.amount,
        email: opts.email,
        reference: opts.reference || `SM-${Date.now()}`,
        description: opts.description,
        callback_url: opts.callback_url,
        metadata: opts.metadata,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.authorization_url) {
      return { error: data?.error || data?.message || 'Impossible d’ouvrir Paystack' };
    }
    return { authorization_url: data.authorization_url, reference: data.reference };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Erreur réseau Paystack' };
  }
}

export async function verifyPaystackPayment(reference: string): Promise<{
  ok: boolean;
  amount_fcfa?: number | null;
  status?: string;
  error?: string;
}> {
  try {
    const res = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(reference)}`);
    const data = await res.json().catch(() => ({}));
    return {
      ok: Boolean(data?.ok),
      amount_fcfa: data?.amount_fcfa,
      status: data?.status,
      error: data?.error,
    };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur vérification' };
  }
}
