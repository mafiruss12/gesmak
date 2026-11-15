import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/sms/send
 * Protégé par INTERNAL_API_SECRET (Bearer)
 * Body: { to: string | string[], message: string, from?: string }
 * Env: AT_USERNAME, AT_API_KEY, AT_FROM, INTERNAL_API_SECRET
 */
const rateMap = new Map<string, { count: number; reset: number }>();

function rateLimit(key: string, limit = 20, windowMs = 60_000): boolean {
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
  if (!internalSecret || auth !== internalSecret) {
    return res.status(401).json({ error: 'Unauthorized – internal use only' });
  }

  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`sms:${clientIp}`)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  const username = process.env.AT_USERNAME;
  const apiKey = process.env.AT_API_KEY;
  const sender = process.env.AT_FROM || 'StockMgr';

  if (!username || !apiKey) {
    return res.status(503).json({
      error: 'Africa’s Talking non configuré',
      hint: 'Ajoutez AT_USERNAME et AT_API_KEY',
    });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  let to = body.to;
  const message = String(body.message || '').trim();
  if (!to || !message) return res.status(400).json({ error: 'to et message requis' });

  if (Array.isArray(to)) to = to.join(',');
  to = String(to)
    .split(',')
    .map((n: string) => {
      let d = n.replace(/\D/g, '');
      if (d.startsWith('00')) d = d.slice(2);
      if (d.startsWith('0') && d.length === 10) d = '225' + d;
      if (!d.startsWith('225') && d.length === 10) d = '225' + d;
      return '+' + d;
    })
    .join(',');

  try {
    const params = new URLSearchParams();
    params.set('username', username);
    params.set('to', to);
    params.set('message', message.slice(0, 480));
    if (sender) params.set('from', sender);

    const r = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        ApiKey: apiKey,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const text = await r.text();
    let data: unknown = text;
    try {
      data = JSON.parse(text);
    } catch {
      /* */
    }
    console.log(JSON.stringify({ ts: new Date().toISOString(), channel: 'sms', to, ok: r.ok, status: r.status }));
    if (!r.ok) return res.status(r.status).json({ ok: false, error: data });
    return res.status(200).json({ ok: true, data });
  } catch (e) {
    console.error('SMS error', e);
    return res.status(500).json({ error: e instanceof Error ? e.message : 'SMS error' });
  }
}
