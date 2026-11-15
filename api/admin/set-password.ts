import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/admin/set-password
 * Body: { user_id: string, password: string }
 * Header: Authorization: Bearer <access_token admin>
 * Seuls admin / super_admin peuvent définir un mot de passe temporaire.
 */
function getEnv(k: string): string | undefined {
  return process.env[k] || process.env[`VITE_${k}`];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    getEnv('SUPABASE_URL') ||
    getEnv('VITE_SUPABASE_URL') ||
    ''
  ).trim();
  const serviceKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    getEnv('SUPABASE_SERVICE_ROLE_KEY') ||
    getEnv('SERVICE_ROLE_KEY') ||
    ''
  ).trim();
  const anonKey = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    getEnv('SUPABASE_ANON_KEY') ||
    getEnv('VITE_SUPABASE_ANON_KEY') ||
    ''
  ).trim();

  if (!supabaseUrl || !serviceKey) {
    const present = Object.keys(process.env)
      .filter((k) => /SUPABASE|SERVICE_ROLE/i.test(k))
      .sort();
    return res.status(503).json({
      error:
        'Clé service Supabase absente ou vide sur Vercel. Ouvrez Supabase → Settings → API → service_role, copiez la clé, ajoutez-la dans Vercel → Environment Variables → SUPABASE_SERVICE_ROLE_KEY (Production).',
      debug_keys: present,
      has_url: Boolean(supabaseUrl),
      has_service: Boolean(serviceKey),
    });
  }

  const authHeader = String(req.headers.authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ error: 'Non authentifié' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const targetUserId = String(body.user_id || '').trim();
  const password = String(body.password || '').trim();

  if (!targetUserId) return res.status(400).json({ error: 'user_id manquant' });
  if (password.length < 6) {
    return res.status(400).json({ error: 'Mot de passe : minimum 6 caractères' });
  }
  if (password.length > 72) {
    return res.status(400).json({ error: 'Mot de passe trop long' });
  }

  try {
    // Vérifier l'appelant via le JWT (anon key + user token)
    const meRes = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
      headers: {
        apikey: anonKey || serviceKey,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!meRes.ok) {
      return res.status(401).json({ error: 'Session invalide ou expirée' });
    }
    const me = (await meRes.json()) as { id?: string };
    if (!me?.id) return res.status(401).json({ error: 'Session invalide' });

    // Rôle admin / super_admin uniquement
    const roleRes = await fetch(
      `${supabaseUrl.replace(/\/$/, '')}/rest/v1/members?user_id=eq.${encodeURIComponent(me.id)}&select=role,status&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    );
    const roles = (await roleRes.json()) as Array<{ role?: string; status?: string }>;
    const role = roles?.[0]?.role || '';
    const status = roles?.[0]?.status || '';
    if (status === 'suspended' || !['admin', 'super_admin'].includes(role)) {
      return res.status(403).json({ error: 'Réservé aux administrateurs' });
    }

    // Ne pas écraser le mot de passe d’un autre super_admin (sauf soi-même)
    const targetRes = await fetch(
      `${supabaseUrl.replace(/\/$/, '')}/rest/v1/members?user_id=eq.${encodeURIComponent(targetUserId)}&select=role&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    );
    const targets = (await targetRes.json()) as Array<{ role?: string }>;
    if (targets?.[0]?.role === 'super_admin' && targetUserId !== me.id) {
      return res.status(403).json({ error: 'Impossible de réinitialiser un super_admin' });
    }

    const upd = await fetch(
      `${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users/${encodeURIComponent(targetUserId)}`,
      {
        method: 'PUT',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      }
    );

    if (!upd.ok) {
      const t = await upd.text();
      console.error('[set-password]', t.slice(0, 300));
      return res.status(400).json({
        error: 'Échec de la mise à jour du mot de passe',
        detail: t.slice(0, 200),
      });
    }

    return res.status(200).json({
      ok: true,
      message: 'Mot de passe temporaire défini. L’utilisateur doit se connecter puis le changer dans Paramètres.',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'error';
    return res.status(500).json({ error: msg });
  }
}
