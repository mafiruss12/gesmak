/**
 * Paiements abonnement — Mobile Money manuel + WhatsApp (V1)
 */
import { PLAN, priceForMonths, paymentWhatsAppLink, SUB_PERIODS } from '@/lib/subscription';

export type PaymentProvider = 'whatsapp' | 'cinetpay' | 'paystack';

export const PAYMENT_METHODS = [
  { id: 'whatsapp' as const, label: 'WhatsApp (validation manuelle)', icon: '💬' },
  { id: 'wave' as const, label: 'Wave', icon: '🌊' },
  { id: 'orange_money' as const, label: 'Orange Money', icon: '🟠' },
  { id: 'mtn_money' as const, label: 'MTN Money', icon: '🟡' },
  { id: 'moov_money' as const, label: 'Moov Money', icon: '🔵' },
];

export function isCinetPayConfigured(): boolean {
  // Le front appelle /api/cinetpay/init — la config réelle est serveur.
  // On considère dispo si pas forcé désactivé.
  return import.meta.env.VITE_CINETPAY_DISABLED !== '1';
}

export function buildSubscriptionWhatsAppMessage(opts: {
  establishmentName: string;
  months: number;
  method?: string;
}): string {
  const amount = priceForMonths(opts.months);
  return [
    '*Stock Manager AI — Paiement abonnement*',
    `Établissement : ${opts.establishmentName}`,
    `Durée : ${opts.months} mois`,
    `Montant : ${amount.toLocaleString('fr-FR')} ${PLAN.currencyLabel}`,
    opts.method ? `Moyen souhaité : ${opts.method}` : null,
    '',
    'Je confirme le paiement Mobile Money / Wave.',
    'Merci d’activer mon abonnement après réception.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function openSubscriptionWhatsApp(opts: {
  establishmentName: string;
  months: number;
  method?: string;
}): void {
  const msg = buildSubscriptionWhatsAppMessage(opts);
  const url = paymentWhatsAppLink(msg);
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Init CinetPay via API serveur sécurisée
 */
export async function initCinetPayCheckout(opts: {
  amount: number;
  transactionId?: string;
  description: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  returnUrl?: string;
  metadata?: string;
}): Promise<{ paymentUrl?: string; transactionId?: string; error?: string }> {
  try {
    const res = await fetch('/api/cinetpay/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: opts.amount,
        transactionId: opts.transactionId || `SM-${Date.now()}`,
        description: opts.description,
        customerName: opts.customerName,
        customerEmail: opts.customerEmail,
        customerPhone: opts.customerPhone,
        returnUrl: opts.returnUrl || `${window.location.origin}/subscription?paid=1`,
        notifyUrl: `${window.location.origin}/api/cinetpay/notify`,
        metadata: opts.metadata || '',
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      return { error: data.error || data.hint || 'Échec CinetPay' };
    }
    return {
      paymentUrl: data.paymentUrl,
      transactionId: data.transactionId,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Réseau indisponible' };
  }
}

export function listPeriods() {
  return SUB_PERIODS.map((p) => ({
    ...p,
    amount: priceForMonths(p.months),
  }));
}


/** Paystack disponible si non désactivé côté front */
export function isPaystackConfigured(): boolean {
  return import.meta.env.VITE_PAYSTACK_DISABLED !== '1';
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
