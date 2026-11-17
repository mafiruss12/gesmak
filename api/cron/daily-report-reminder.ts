/**
 * Cron Vercel : rappel rapport journalier obligatoire
 * GET/POST /api/cron/daily-report-reminder
 * Header obligatoire: Authorization: Bearer <CRON_SECRET>
 *
 * Variables Vercel :
 * - SUPABASE_URL ou VITE_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - CRON_SECRET (obligatoire)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

const REPORT_ROLES = ['manager', 'cashier', 'employee'];

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function getEnv(name: string): string | undefined {
  return process.env[name] || process.env[`VITE_${name}`];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = getEnv('CRON_SECRET');
  if (!secret) {
    return res.status(500).json({ error: 'CRON_SECRET manquant (obligatoire)' });
  }

  const auth = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (auth !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl =
    getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL') || 'https://ycoaxbgxstxondxxnhhf.supabase.co';
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!serviceKey) {
    return res.status(500).json({
      error: 'SUPABASE_SERVICE_ROLE_KEY manquant sur Vercel',
    });
  }

  const date = todayISO();
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  async function sbGet(path: string) {
    const r = await fetch(`${supabaseUrl}/rest/v1/${path}`, { headers });
    if (!r.ok) throw new Error(`${path} ${r.status} ${await r.text()}`);
    return r.json();
  }

  async function sbPost(path: string, body: unknown) {
    const r = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`${path} ${r.status} ${await r.text()}`);
  }

  try {
    const establishments = (await sbGet(
      'establishments?select=id,name,phone,owner_email,owner_user_id,owner_phone&status=eq.active'
    )) as Array<{
      id: string;
      name: string;
      phone?: string;
      owner_email?: string;
      owner_user_id?: string;
      owner_phone?: string;
    }>;

    if (!Array.isArray(establishments)) {
      return res.status(500).json({ error: 'establishments fetch failed' });
    }

    // Rapports déjà faits aujourd'hui
    const reports = (await sbGet(
      `daily_reports?select=establishment_id&date=eq.${date}`
    )) as Array<{ establishment_id: string }>;
    const done = new Set((reports || []).map((r) => r.establishment_id));

    const missingEst = establishments.filter((e) => !done.has(e.id));
    let notifications = 0;
    const details: Array<{ est: string; staff: number }> = [];

    for (const est of missingEst) {
      const members = (await sbGet(
        `members?select=user_id,full_name,email,role,phone&establishment_id=eq.${est.id}&status=eq.active`
      )) as Array<{
        user_id: string;
        full_name?: string;
        email?: string;
        role: string;
        phone?: string;
      }>;

      const staff = members.filter((m) => REPORT_ROLES.includes(m.role) && m.user_id);
      const title = `Rapport journalier obligatoire — ${date}`;
      const body =
        `Le rapport de clôture de « ${est.name} » n'est pas encore enregistré pour le ${date}. ` +
        `Merci de le compléter maintenant (menu Rapport du jour).`;

      for (const m of staff) {
        try {
          await sbPost('notifications', {
            user_id: m.user_id,
            title,
            body,
            message: body,
            type: 'report_reminder_cron',
            link: '/daily-report',
            read: false,
            action_label: 'Faire le rapport',
          });
          notifications++;
        } catch {
          /* ignore per-user errors */
        }
      }

      if (est.owner_user_id) {
        try {
          await sbPost('notifications', {
            user_id: est.owner_user_id,
            title: `Clôture manquante — ${est.name}`,
            body: `Aucun rapport journalier pour le ${date}. L'équipe a été relancée automatiquement.`,
            message: `Aucun rapport journalier pour le ${date}.`,
            type: 'report_missing_owner',
            link: '/suivi',
            read: false,
            action_label: 'Voir suivi',
          });
          notifications++;
        } catch {
          /* */
        }
      }

      details.push({ est: est.name, staff: staff.length });
    }

    return res.status(200).json({
      ok: true,
      date,
      establishments_total: establishments.length,
      missing_reports: missingEst.length,
      notifications_sent: notifications,
      details,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: message });
  }
}
