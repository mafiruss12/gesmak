/**
 * Cloudflare Pages Function — rate-limit login
 * POST /api/security/login-throttle
 */
type Env = Record<string, string | undefined>;

const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;
type Entry = { fails: number; lockedUntil: number; windowStart: number };
const mem = new Map<string, Entry>();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

function clientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

function keyOf(ip: string, id: string) {
  return `${ip}::${id.toLowerCase().slice(0, 120)}`;
}

function readMem(key: string): Entry {
  const now = Date.now();
  const e = mem.get(key);
  if (!e) return { fails: 0, lockedUntil: 0, windowStart: now };
  if (now - e.windowStart > WINDOW_MS && now > e.lockedUntil) {
    return { fails: 0, lockedUntil: 0, windowStart: now };
  }
  return e;
}

export const onRequestOptions = async () => json({}, 200);

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  let body: { action?: string; identifier?: string } = {};
  try {
    body = (await context.request.json()) as typeof body;
  } catch {
    return json({ error: 'JSON invalide' }, 400);
  }
  const action = String(body.action || 'check');
  const identifier = String(body.identifier || '').trim();
  if (!identifier) return json({ error: 'identifier requis' }, 400);

  const ip = clientIp(context.request);
  const key = keyOf(ip, identifier);
  const now = Date.now();
  let e = readMem(key);

  if (action === 'success') {
    mem.set(key, { fails: 0, lockedUntil: 0, windowStart: now });
    return json({ ok: true, locked: false, remainingMs: 0, fails: 0 });
  }
  if (action === 'fail') {
    e = {
      fails: e.fails + 1,
      lockedUntil: e.fails + 1 >= MAX_ATTEMPTS ? now + LOCK_MS : e.lockedUntil,
      windowStart: e.windowStart || now,
    };
    mem.set(key, e);
    const locked = now < e.lockedUntil;
    return json({
      ok: true,
      locked,
      remainingMs: locked ? Math.max(0, e.lockedUntil - now) : 0,
      fails: e.fails,
      maxAttempts: MAX_ATTEMPTS,
    });
  }
  const locked = now < e.lockedUntil;
  return json({
    ok: true,
    locked,
    remainingMs: locked ? Math.max(0, e.lockedUntil - now) : 0,
    fails: e.fails,
    maxAttempts: MAX_ATTEMPTS,
  });
};
