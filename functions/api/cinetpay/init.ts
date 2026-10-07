import { json, env, readBody, noContent } from '../_lib/http';
const SITE = 'https://stock-manager-ai.pages.dev';
export async function onRequest(context: { request: Request; env: Record<string, string | undefined> }) {
  const { request } = context;
  if (request.method === 'OPTIONS') return noContent();
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const apiKey = env(context, 'CINETPAY_API_KEY');
  const siteId = env(context, 'CINETPAY_SITE_ID');
  if (!apiKey || !siteId) return json({ error: 'CinetPay non configuré' }, 503);
  const body = await readBody(request);
  const amount = Math.round(Number(body.amount) || 0);
  if (amount < 100) return json({ error: 'Montant minimum 100 XOF' }, 400);
  const transactionId = String(body.transactionId || `SM-${Date.now()}`).slice(0, 40);
  const payload = {
    apikey: apiKey, site_id: siteId, transaction_id: transactionId, amount, currency: 'XOF',
    description: String(body.description || 'Abonnement Stock Manager AI').slice(0, 100),
    return_url: String(body.returnUrl || `${SITE}/subscription`),
    notify_url: String(body.notifyUrl || `${SITE}/api/cinetpay/notify`),
    channels: 'ALL', lang: 'fr', metadata: body.metadata || '',
    customer_name: String(body.customerName || 'Client').slice(0, 50),
    customer_email: String(body.customerEmail || 'client@stock-manager.local'),
    customer_phone_number: String(body.customerPhone || '22500000000').replace(/\D/g, ''),
    customer_address: 'Abidjan', customer_city: 'Abidjan', customer_country: 'CI', customer_state: 'CI', customer_zip_code: '00225',
  };
  const r = await fetch('https://api-checkout.cinetpay.com/v2/payment', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload),
  });
  const data = (await r.json()) as { code?: string; message?: string; description?: string; data?: { payment_url?: string; payment_token?: string } };
  if (data.code === '201' && data.data?.payment_url) {
    return json({ ok: true, paymentUrl: data.data.payment_url, paymentToken: data.data.payment_token, transactionId });
  }
  return json({ ok: false, error: data.description || data.message || 'Échec CinetPay', code: data.code }, 400);
}
