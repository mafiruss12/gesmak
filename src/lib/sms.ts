/**
 * SMS via Africa’s Talking — POST /api/sms/send
 */

export async function sendSms(opts: {
  to: string | string[];
  message: string;
}): Promise<{ ok: boolean; detail: string; data?: unknown }> {
  try {
    const res = await fetch('/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      return {
        ok: false,
        detail: data.error || data.hint || `HTTP ${res.status}`,
        data,
      };
    }
    return { ok: true, detail: 'SMS envoyé', data: data.data };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : 'Erreur réseau' };
  }
}

export function smsHelpText(): string {
  return [
    'Africa’s Talking (SMS) :',
    '1. Compte https://account.africastalking.com',
    '2. Vercel → AT_USERNAME + AT_API_KEY (+ AT_FROM optionnel)',
    '3. Endpoint actif : POST /api/sms/send',
  ].join('\n');
}
