import { json, env, bearer, readBody, noContent } from '../_lib/http';
export async function onRequest(context: { request: Request; env: Record<string, string | undefined> }) {
  const { request } = context;
  if (request.method === 'OPTIONS') return noContent();
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const secret = env(context, 'INTERNAL_API_SECRET') || env(context, 'CRON_SECRET');
  if (!secret || bearer(request) !== secret) return json({ error: 'Unauthorized' }, 401);
  const username = env(context, 'AT_USERNAME');
  const apiKey = env(context, 'AT_API_KEY');
  if (!username || !apiKey) return json({ error: 'Africa Talking non configuré' }, 503);
  const body = await readBody(request);
  let to = String(body.to || '').replace(/\D/g, '');
  if (to.startsWith('0') && to.length === 10) to = '225' + to;
  if (!to.startsWith('+')) to = '+' + to;
  const message = String(body.message || '').trim();
  if (!to || !message) return json({ error: 'to et message requis' }, 400);
  const params = new URLSearchParams({ username, to, message });
  const r = await fetch('https://api.africastalking.com/version1/messaging', {
    method: 'POST', headers: { apiKey, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: params.toString(),
  });
  const data = await r.json();
  return json(r.ok ? { ok: true, data } : { error: 'SMS error', raw: data }, r.ok ? 200 : r.status);
}
