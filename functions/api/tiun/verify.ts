import { json, env, readBody, noContent } from '../_lib/http';
export async function onRequest(context: { request: Request; env: Record<string, string | undefined> }) {
  const { request } = context;
  if (request.method === 'OPTIONS') return noContent();
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const apiKey = env(context, 'TIUN_API_KEY');
  if (!apiKey) return json({ error: 'TIUN non configuré' }, 503);
  const body = await readBody(request);
  const phone = String(body.phone || '').replace(/\D/g, '');
  if (!phone) return json({ error: 'phone requis' }, 400);
  const r = await fetch('https://api.tiun.app/v1/verify', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, ...body }),
  });
  return json(await r.json(), r.status);
}
