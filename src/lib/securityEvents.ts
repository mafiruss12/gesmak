
import { supabase } from '@/lib/supabase';

export type SecurityEventType =
  | 'login_success'
  | 'login_failure'
  | 'mfa_challenge'
  | 'mfa_success'
  | 'mfa_setup'
  | 'logout'
  | 'password_reset_request'
  | 'signup';

/** Journal sécurité (ignore si table absente) */
export async function logSecurityEvent(
  type: SecurityEventType,
  meta?: Record<string, unknown>
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('security_events').insert({
      event_type: type,
      user_id: user?.id ?? null,
      meta: meta || {},
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 240) : null,
      created_at: new Date().toISOString(),
    });
  } catch {
    /* table absente ou RLS */
  }
}
