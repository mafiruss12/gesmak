import { json, env, bearer } from '../_lib/http';
const REPORT_ROLES = ['manager', 'cashier', 'employee'];
function todayISO() { return new Date().toISOString().split('T')[0]; }
export async function onRequest(context: { request: Request; env: Record<string, string | undefined> }) {
  const { request } = context;
  if (request.method !== 'GET' && request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const secret = env(context, 'CRON_SECRET');
  if (!secret) return json({ error: 'CRON_SECRET manquant' }, 500);
  if (bearer(request) !== secret) return json({ error: 'Unauthorized' }, 401);
  const supabaseUrl = env(context, 'SUPABASE_URL') || env(context, 'VITE_SUPABASE_URL') || 'https://ycoaxbgxstxondxxnhhf.supabase.co';
  const serviceKey = env(context, 'SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, 500);
  const date = todayISO();
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
  try {
    const er = await fetch(`${supabaseUrl}/rest/v1/establishments?select=id,name,owner_user_id&status=eq.active`, { headers });
    const establishments = (await er.json()) as Array<{ id: string; name: string; owner_user_id?: string }>;
    let notified = 0;
    const details: string[] = [];
    for (const est of Array.isArray(establishments) ? establishments : []) {
      const mr = await fetch(`${supabaseUrl}/rest/v1/member_establishments?select=user_id,role&establishment_id=eq.${est.id}`, { headers });
      const members = (await mr.json()) as Array<{ user_id: string; role: string }>;
      const staff = (members || []).filter((m) => REPORT_ROLES.includes(String(m.role || '').toLowerCase()));
      const rr = await fetch(`${supabaseUrl}/rest/v1/daily_reports?select=id,created_by&establishment_id=eq.${est.id}&report_date=eq.${date}`, { headers });
      const reports = (await rr.json()) as Array<{ created_by?: string }>;
      const reportedBy = new Set((reports || []).map((r) => r.created_by).filter(Boolean));
      const missing = staff.filter((s) => !reportedBy.has(s.user_id));
      if (missing.length === 0) { details.push(`${est.name}: OK`); continue; }
      if (est.owner_user_id) {
        const nr = await fetch(`${supabaseUrl}/rest/v1/notifications`, {
          method: 'POST', headers: { ...headers, Prefer: 'return=minimal' },
          body: JSON.stringify({ user_id: est.owner_user_id, title: 'Rapport du jour manquant', body: `${missing.length} employé(s) sans point du ${date} — ${est.name}`, type: 'daily_report_reminder', establishment_id: est.id, read: false }),
        });
        if (nr.ok) notified++;
      }
      details.push(`${est.name}: ${missing.length} manquant(s)`);
    }
    return json({ ok: true, date, notified, details });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Erreur cron' }, 500);
  }
}
