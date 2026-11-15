/**
 * Hook HTTP sécurité — Webhook Supabase
 * POST /api/security/auth-hook
 *
 * Auth: Authorization: Bearer <SECURITY_HOOK_SECRET|CRON_SECRET>
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

function getEnv(name: string): string | undefined {
  const v = process.env[name] || process.env[`VITE_${name}`];
  return v && String(v).trim() ? String(v).trim() : undefined;
}

function authorized(req: VercelRequest): boolean {
  const secrets = [getEnv('SECURITY_HOOK_SECRET'), getEnv('CRON_SECRET')].filter(Boolean) as string[];
  if (!secrets.length) return false;
  const auth = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const hdr = String(req.headers['x-security-hook-secret'] || '');
  const q = typeof req.query.secret === 'string' ? req.query.secret : '';
  return secrets.some((s) => auth === s || hdr === s || q === s);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!authorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = (req.body || {}) as Record<string, unknown>;
  let eventType = String(body.type || body.event_type || 'webhook');
  let userId = (body.user_id as string) || null;
  let meta: Record<string, unknown> = (body.meta as Record<string, unknown>) || {};

  const record = body.record as Record<string, unknown> | undefined;
  if (record) {
    userId = (record.id as string) || (record.user_id as string) || userId;
    meta = {
      ...meta,
      email: record.email,
      role: record.role,
      table: body.table,
      schema: body.schema,
    };
  }

  const map: Record<string, string> = {
    USER_SIGNED_UP: 'signup',
    INSERT: 'db_insert',
    UPDATE: 'db_update',
    DELETE: 'db_delete',
  };
  eventType = map[eventType] || eventType;

  const supabaseUrl = getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL') || '';
  const serviceKey =
    getEnv('SUPABASE_SERVICE_ROLE_KEY') ||
    getEnv('SERVICE_ROLE_KEY') ||
    getEnv('SUPABASE_SERVICE_KEY');

  // Toujours acquitter le webhook (évite retries pg_net) même si insert impossible
  if (!supabaseUrl || !serviceKey) {
    console.warn('[auth-hook] service role manquant — ack only', { eventType, userId });
    return res.status(200).json({
      ok: true,
      ack: true,
      persisted: false,
      event_type: eventType,
      warning: 'SUPABASE_SERVICE_ROLE_KEY absente au runtime API',
    });
  }

  try {
    const r = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/security_events`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        event_type: eventType,
        user_id: userId,
        meta,
        user_agent: String(req.headers['user-agent'] || '').slice(0, 240) || null,
        created_at: new Date().toISOString(),
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      console.warn('[auth-hook] insert_failed', t.slice(0, 200));
      return res.status(200).json({ ok: true, persisted: false, detail: t.slice(0, 200) });
    }
    return res.status(200).json({ ok: true, persisted: true, event_type: eventType });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'error';
    return res.status(200).json({ ok: true, persisted: false, error: msg });
  }
}
