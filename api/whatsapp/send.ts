import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/whatsapp/send
 * Protégé par INTERNAL_API_SECRET (Bearer) ou appel depuis le même origin avec session.
 * Body: { to: string, message: string } ou template
 * Env: WA_TOKEN, WA_PHONE_NUMBER_ID, INTERNAL_API_SECRET
 */
const rateMap = new Map<string, { count: number; reset: number }>();

function rateLimit(key: string, limit = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateMap.get(key);
  if (!entry || now > entry.reset) {
    rateMap.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const internalSecret = process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET;
  const auth = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const isInternal = internalSecret && auth === internalSecret;

  // Autoriser uniquement les appels internes authentifiés
  if (!isInternal) {
    return res.status(401).json({ error: 'Unauthorized – internal use only' });
  }

  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`wa:${clientIp}`)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  const token = process.env.WA_TOKEN || process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WA_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    return res.status(503).json({
      error: 'WhatsApp Cloud non configuré',
      hint: 'Ajoutez WA_TOKEN et WA_PHONE_NUMBER_ID',
    });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  let to = String(body.to || '').replace(/\D/g, '');
  if (to.startsWith('00')) to = to.slice(2);
  if (to.startsWith('0') && to.length === 10) to = '225' + to;
  if (!to.startsWith('225') && to.length === 10) to = '225' + to;
  if (!to) return res.status(400).json({ error: 'to requis' });

  if (!rateLimit(`wa:to:${to}`, 10, 60_000)) {
    return res.status(429).json({ error: 'Trop de messages vers ce numéro' });
  }

  const version = process.env.WA_API_VERSION || 'v19.0';
  const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;

  let payload: Record<string, unknown>;
  if (body.template) {
    payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: body.template,
        language: { code: body.language || 'fr' },
        components: body.components || [],
      },
    };
  } else {
    const message = String(body.message || '').trim();
    if (!message) return res.status(400).json({ error: 'message ou template requis' });
    payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { preview_url: false, body: message.slice(0, 4096) },
    };
  }

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    console.log(JSON.stringify({ ts: new Date().toISOString(), channel: 'whatsapp', to, ok: r.ok, status: r.status }));
    if (!r.ok) return res.status(r.status).json({ ok: false, error: data });
    return res.status(200).json({ ok: true, data });
  } catch (e) {
    console.error('WhatsApp error', e);
    return res.status(500).json({ error: e instanceof Error ? e.message : 'WhatsApp error' });
  }
}
