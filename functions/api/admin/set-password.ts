import { json, env, bearer, readBody, noContent } from '../_lib/http';
export async function onRequest(context: { request: Request; env: Record<string, string | undefined> }) {
  const { request } = context;
  if (request.method === 'OPTIONS') return noContent();
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const supabaseUrl = (env(context, 'SUPABASE_URL') || env(context, 'VITE_SUPABASE_URL') || 'https://ycoaxbgxstxondxxnhhf.supabase.co').trim();
  const serviceKey = (env(context, 'SUPABASE_SERVICE_ROLE_KEY') || '').trim();
  const anonKey = (env(context, 'SUPABASE_ANON_KEY') || env(context, 'VITE_SUPABASE_ANON_KEY') || '').trim();
  if (!supabaseUrl || !serviceKey) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, 503);
  const token = bearer(request);
  if (!token) return json({ error: 'Non authentifié' }, 401);
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: anonKey || serviceKey } });
  if (!userRes.ok) return json({ error: 'Session invalide' }, 401);
  const user = (await userRes.json()) as { id?: string };
  if (!user?.id) return json({ error: 'Session invalide' }, 401);
  const roleRes = await fetch(`${supabaseUrl}/rest/v1/members?select=role&user_id=eq.${user.id}&limit=1`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
  const roles = (await roleRes.json()) as Array<{ role?: string }>;
  const role = String(roles?.[0]?.role || '').toLowerCase();
  if (!['admin', 'super_admin'].includes(role)) return json({ error: 'Réservé aux administrateurs' }, 403);
  const body = await readBody(request);
  const userId = String(body.user_id || '').trim();
  const password = String(body.password || '').trim();
  if (!userId || password.length < 6) return json({ error: 'user_id et password (min 6) requis' }, 400);
  const upd = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: 'PUT', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
  });
  if (!upd.ok) return json({ error: await upd.text() }, upd.status);
  return json({ ok: true });
}
