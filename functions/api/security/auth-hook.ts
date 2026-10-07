import { json, env, readBody } from '../_lib/http';
export async function onRequest(context: { request: Request; env: Record<string, string | undefined> }) {
  if (context.request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const body = await readBody(context.request);
  return json({ ok: true, received: Boolean(body) });
}
