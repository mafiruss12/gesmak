import { json, env, bearer } from '../_lib/http';
export async function onRequest(context: { request: Request; env: Record<string, string | undefined> }) {
  const { request } = context;
  if (request.method !== 'GET' && request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const secret = env(context, 'CRON_SECRET');
  if (!secret) return json({ error: 'CRON_SECRET manquant' }, 500);
  if (bearer(request) !== secret) return json({ error: 'Unauthorized' }, 401);
  const supabaseUrl = env(context, 'SUPABASE_URL') || env(context, 'VITE_SUPABASE_URL') || 'https://ycoaxbgxstxondxxnhhf.supabase.co';
  const serviceKey = env(context, 'SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, 500);
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
  try {
    const now = new Date();
    const day = now.getUTCDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() + mondayOffset - 7);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    const from = monday.toISOString().slice(0, 10);
    const to = sunday.toISOString().slice(0, 10);
    const r = await fetch(`${supabaseUrl}/rest/v1/establishments?select=id,name,owner_user_id&status=eq.active`, { headers });
    const establishments = (await r.json()) as Array<{ id: string; name: string; owner_user_id?: string }>;
    let sent = 0;
    for (const est of establishments || []) {
      if (!est.owner_user_id) continue;
      const nr = await fetch(`${supabaseUrl}/rest/v1/notifications`, {
        method: 'POST', headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ user_id: est.owner_user_id, title: 'Rapport hebdomadaire', body: `Synthèse du ${from} au ${to} — ${est.name}. Voir Comptabilité.`, type: 'weekly_profit', establishment_id: est.id, read: false }),
      });
      if (nr.ok) sent++;
    }
    return json({ ok: true, from, to, sent });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Erreur cron' }, 500);
  }
}
