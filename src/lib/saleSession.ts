/**
 * GESMAK 3B.2 — attach sales to cash sessions (feature-flagged).
 * When flags are off, callers keep legacy behaviour.
 */
import { supabase } from '@/lib/supabase';
import { featureFlags } from '@/lib/featureFlags';
import { getActiveSessionId } from '@/lib/serviceDay';
import { newClientOpId } from '@/lib/audit';

export type SaleSessionContext = {
  establishmentId: string;
  userId: string | null;
  /** Optional cash register when multi-services is enabled */
  cashRegisterId?: string | null;
};

export type ResolveSaleSessionResult =
  | {
      ok: true;
      sessionId: string | null;
      clientOpId: string;
      requireSession: boolean;
    }
  | {
      ok: false;
      message: string;
      clientOpId: string;
      requireSession: boolean;
    };

/**
 * Resolve session for a new sale.
 * - Flags off: session optional (attach if found), never block.
 * - requireCashSession on: block if no open session for establishment.
 * - multiServices + cashRegisterId: prefer session on that register when column exists.
 */
export async function resolveSaleSession(
  ctx: SaleSessionContext
): Promise<ResolveSaleSessionResult> {
  const clientOpId = newClientOpId();
  const requireSession = featureFlags.requireCashSessionOnSale;

  let sessionId: string | null = null;

  try {
    if (featureFlags.multiServices && ctx.cashRegisterId) {
      const { data } = await supabase
        .from('cash_sessions')
        .select('id, establishment_id, status, cash_register_id')
        .eq('establishment_id', ctx.establishmentId)
        .eq('cash_register_id', ctx.cashRegisterId)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      sessionId = data?.id || null;
    }

    if (!sessionId) {
      sessionId = await getActiveSessionId(ctx.establishmentId);
    }

    if (sessionId && featureFlags.multiServices && ctx.userId && featureFlags.strictSessionUniqueness) {
      // Soft check: cashier assignment when tables exist (ignore if table missing)
      if (ctx.cashRegisterId) {
        const { data: asg, error } = await supabase
          .from('cash_register_assignments')
          .select('id')
          .eq('cash_register_id', ctx.cashRegisterId)
          .eq('user_id', ctx.userId)
          .eq('status', 'active')
          .maybeSingle();
        if (!error && !asg) {
          return {
            ok: false,
            message: 'Caisse non affectée à cet utilisateur.',
            clientOpId,
            requireSession,
          };
        }
      }
    }
  } catch {
    sessionId = null;
  }

  if (requireSession && !sessionId) {
    return {
      ok: false,
      message: 'Aucune session de caisse ouverte. Ouvrez la journée / caisse avant de vendre.',
      clientOpId,
      requireSession,
    };
  }

  return { ok: true, sessionId, clientOpId, requireSession };
}

/**
 * Build sale row fields related to session / idempotence.
 * Does not include product lines.
 */
export function applySaleSessionFields(
  payload: Record<string, unknown>,
  resolved: Extract<ResolveSaleSessionResult, { ok: true }>
): Record<string, unknown> {
  const out = { ...payload };
  if (resolved.sessionId) {
    out.cash_session_id = resolved.sessionId;
  }
  // Client-side idempotence marker kept for offline queue; stripped before some inserts if column absent
  out._client_op_id = resolved.clientOpId;
  return out;
}

/**
 * Online path: stock is decremented by DB trigger `trg_decrement_stock_on_sale`.
 * Offline path: app must adjust stock locally (trigger runs only on server insert).
 */
export function shouldAppDecrementStock(online: boolean): boolean {
  return !online;
}
