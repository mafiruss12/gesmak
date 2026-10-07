import { json, env, readBody } from '../_lib/http';
export async function onRequest(context: { request: Request; env: Record<string, string | undefined> }) {
  const { request } = context;
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const apiKey = env(context, 'CINETPAY_API_KEY');
  const siteId = env(context, 'CINETPAY_SITE_ID');
  const body = await readBody(request);
  const transactionId = body.cpm_trans_id || body.transaction_id || body.transactionId;
  if (!transactionId) return json({ error: 'transaction_id manquant' }, 400);
  if (!apiKey || !siteId) return json({ error: 'CinetPay non configuré' }, 503);
  const supabaseUrl = env(context, 'SUPABASE_URL') || env(context, 'VITE_SUPABASE_URL') || 'https://ycoaxbgxstxondxxnhhf.supabase.co';
  const serviceKey = env(context, 'SUPABASE_SERVICE_ROLE_KEY');
  const check = await fetch('https://api-checkout.cinetpay.com/v2/payment/check', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apikey: apiKey, site_id: siteId, transaction_id: transactionId }),
  });
  const result = (await check.json()) as { code?: string; data?: { status?: string; amount?: string | number; currency?: string; metadata?: string } };
  if (result.code !== '00' || result.data?.status !== 'ACCEPTED') {
    return json({ ok: true, status: result.data?.status || 'PENDING', code: result.code });
  }
  if (!serviceKey) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, 500);
  const meta = String(result.data?.metadata || body.metadata || '');
  const [estId, monthsStr, userId] = meta.split('|');
  const months = Math.max(1, parseInt(monthsStr || '1', 10) || 1);
  if (!estId) return json({ error: 'metadata establishment_id manquant' }, 400);
  const paidAmount = Math.round(Number(result.data?.amount || 0));
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
  const end = new Date(); end.setMonth(end.getMonth() + months);
  await fetch(`${supabaseUrl}/rest/v1/establishments?id=eq.${estId}`, {
    method: 'PATCH', headers,
    body: JSON.stringify({ subscription_status: 'active', subscription_ends_at: end.toISOString(), subscription_months: months, last_payment_at: new Date().toISOString() }),
  }).catch(() => null);
  if (userId) {
    await fetch(`${supabaseUrl}/rest/v1/notifications`, {
      method: 'POST', headers,
      body: JSON.stringify({ user_id: userId, title: 'Paiement reçu', body: `Abonnement ${months} mois — ${paidAmount} F`, type: 'payment', read: false }),
    }).catch(() => null);
  }
  return json({ ok: true, status: 'ACCEPTED', transactionId, months, paidAmount });
}
