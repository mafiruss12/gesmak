import { json, env, bearer, readBody, noContent } from '../_lib/http';
export async function onRequest(context: { request: Request; env: Record<string, string | undefined> }) {
  const { request } = context;
  if (request.method === 'OPTIONS') return noContent();
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const secret = env(context, 'INTERNAL_API_SECRET') || env(context, 'CRON_SECRET');
  if (!secret || bearer(request) !== secret) return json({ error: 'Unauthorized' }, 401);
  const token = env(context, 'WA_TOKEN') || env(context, 'WHATSAPP_TOKEN');
  const phoneNumberId = env(context, 'WA_PHONE_NUMBER_ID') || env(context, 'WHATSAPP_PHONE_NUMBER_ID');
  if (!token || !phoneNumberId) return json({ error: 'WhatsApp non configuré' }, 503);
  const body = await readBody(request);
  let to = String(body.to || '').replace(/\D/g, '');
  if (to.startsWith('0') && to.length === 10) to = '225' + to;
  if (!to.startsWith('225') && to.length === 10) to = '225' + to;
  if (!to) return json({ error: 'to requis' }, 400);
  const message = String(body.message || '').trim();
  if (!message && !body.template) return json({ error: 'message ou template requis' }, 400);
  const version = env(context, 'WA_API_VERSION') || 'v19.0';
  const payload = body.template
    ? { messaging_product: 'whatsapp', to, type: 'template', template: { name: body.template, language: { code: body.language || 'fr' }, components: body.components || [] } }
    : { messaging_product: 'whatsapp', to, type: 'text', text: { body: message } };
  const r = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const data = await r.json();
  return json(r.ok ? { ok: true, data } : { error: 'WhatsApp API error', raw: data }, r.ok ? 200 : r.status);
}
