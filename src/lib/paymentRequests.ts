/**
 * Demandes d'activation abonnement — Mobile Money manuel + WhatsApp
 * Table: payment_requests (migration 20260917). Fallback WA si table absente.
 */
import { supabase } from '@/lib/supabase';
import { PLANS, type PlanTier, paymentWhatsAppLink } from '@/lib/subscription';

export type PaymentRequestStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export type PaymentRequest = {
  id: string;
  establishment_id: string;
  user_id: string;
  plan_tier: PlanTier;
  months: number;
  amount_fcfa: number;
  payment_method: string;
  reference_code: string;
  status: PaymentRequestStatus;
  proof_note?: string | null;
  created_at: string;
};

function randomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = 'SM-';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

export function amountForPlanMonths(tier: PlanTier, months: number): number {
  const m = Math.max(1, Math.floor(months));
  return PLANS[tier].monthlyFcfa * m;
}

export async function listMyPendingRequests(establishmentId: string): Promise<PaymentRequest[]> {
  try {
    const { data, error } = await supabase
      .from('payment_requests')
      .select('*')
      .eq('establishment_id', establishmentId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5);
    if (error) return [];
    return (data || []) as PaymentRequest[];
  } catch {
    return [];
  }
}

export async function listAllPendingRequests(): Promise<PaymentRequest[]> {
  try {
    const { data, error } = await supabase
      .from('payment_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return [];
    return (data || []) as PaymentRequest[];
  } catch {
    return [];
  }
}

export async function createPaymentRequest(opts: {
  establishmentId: string;
  userId: string;
  planTier: PlanTier;
  months: number;
  paymentMethod: string;
  establishmentName: string;
}): Promise<{ ok: boolean; request?: PaymentRequest; waUrl: string; error?: string }> {
  const months = Math.max(1, Math.floor(opts.months));
  const amount = amountForPlanMonths(opts.planTier, months);
  const reference_code = randomCode();
  const planLabel = PLANS[opts.planTier].label;

  const waMsg = [
    '*GESMAK — Demande d’activation*',
    `Code : ${reference_code}`,
    `Établissement : ${opts.establishmentName}`,
    `Forfait : ${planLabel}`,
    `Durée : ${months} mois`,
    `Montant : ${amount.toLocaleString('fr-FR')} F CFA`,
    `Moyen : ${opts.paymentMethod}`,
    '',
    'Je confirme le paiement Mobile Money. Merci d’activer mon abonnement.',
  ].join('\n');
  const waUrl = paymentWhatsAppLink(waMsg);

  try {
    const { data, error } = await supabase
      .from('payment_requests')
      .insert({
        establishment_id: opts.establishmentId,
        user_id: opts.userId,
        plan_tier: opts.planTier,
        months,
        amount_fcfa: amount,
        payment_method: opts.paymentMethod,
        reference_code,
        status: 'pending',
      })
      .select('*')
      .maybeSingle();

    if (error) {
      // Table absente ou RLS : fallback WhatsApp seul
      return {
        ok: true,
        waUrl,
        error: `Demande locale (sync admin plus tard): ${error.message}`,
        request: {
          id: 'local',
          establishment_id: opts.establishmentId,
          user_id: opts.userId,
          plan_tier: opts.planTier,
          months,
          amount_fcfa: amount,
          payment_method: opts.paymentMethod,
          reference_code,
          status: 'pending',
          created_at: new Date().toISOString(),
        },
      };
    }

    return { ok: true, request: data as PaymentRequest, waUrl };
  } catch (e) {
    return {
      ok: true,
      waUrl,
      error: e instanceof Error ? e.message : 'fallback',
      request: {
        id: 'local',
        establishment_id: opts.establishmentId,
        user_id: opts.userId,
        plan_tier: opts.planTier,
        months,
        amount_fcfa: amount,
        payment_method: opts.paymentMethod,
        reference_code,
        status: 'pending',
        created_at: new Date().toISOString(),
      },
    };
  }
}

export async function approvePaymentRequest(id: string, note?: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('approve_payment_request', {
    p_request_id: id,
    p_note: note || null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function rejectPaymentRequest(id: string, note?: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('reject_payment_request', {
    p_request_id: id,
    p_note: note || null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Appelle la RPC serveur si dispo ; ignore si absente */
export async function serverAssertCanAddProduct(establishmentId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('assert_can_add_product', { p_est: establishmentId });
    if (error) {
      if (/schema cache|does not exist|function/i.test(error.message)) return { ok: true };
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

export async function serverAssertCanAddMember(establishmentId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('assert_can_add_member', { p_est: establishmentId });
    if (error) {
      if (/schema cache|does not exist|function/i.test(error.message)) return { ok: true };
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}
