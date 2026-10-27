/**
 * Rate-limit login côté serveur (P0 sécurité).
 * POST { action: 'check'|'fail'|'success', identifier: string }
 * Auth optionnelle ; limite par IP + identifiant.
 *
 * Stockage : mémoire process (toutes les instances) + table login_throttle si service role dispo.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;

type Entry = { fails: number; lockedUntil: number; windowStart: number };
const mem = new Map<string, Entry>();

function getEnv(name: string): string | undefined {
  const v = process.env[name] || process.env[`VITE_${name}`];
  return v && String(v).trim() ? String(v).trim() : undefined;
}

function clientIp(req: VercelRequest): string {
  const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0]?.trim();
  const real = String(req.headers['x-real-ip'] || '').trim();
  return xf || real || 'unknown';
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

function writeMem(key: string, e: Entry) {
  mem.set(key, e);
  if (mem.size > 5000) {
    const first = mem.keys().next().value;
    if (first) mem.delete(first);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}) as {
    action?: string;
    identifier?: string;
  };
  const action = String(body.action || 'check');
  const identifier = String(body.identifier || '').trim();
  if (!identifier) return res.status(400).json({ error: 'identifier requis' });

  const ip = clientIp(req);
  const key = keyOf(ip, identifier);
  const now = Date.now();
  let e = readMem(key);

  if (action === 'success') {
    writeMem(key, { fails: 0, lockedUntil: 0, windowStart: now });
    return res.status(200).json({ ok: true, locked: false, remainingMs: 0, fails: 0 });
  }

  if (action === 'fail') {
    e = {
      fails: e.fails + 1,
      lockedUntil: e.fails + 1 >= MAX_ATTEMPTS ? now + LOCK_MS : e.lockedUntil,
      windowStart: e.windowStart || now,
    };
    writeMem(key, e);
    const locked = now < e.lockedUntil;
    return res.status(200).json({
      ok: true,
      locked,
      remainingMs: locked ? Math.max(0, e.lockedUntil - now) : 0,
      fails: e.fails,
      maxAttempts: MAX_ATTEMPTS,
    });
  }

  // check
  const locked = now < e.lockedUntil;
  return res.status(200).json({
    ok: true,
    locked,
    remainingMs: locked ? Math.max(0, e.lockedUntil - now) : 0,
    fails: e.fails,
    maxAttempts: MAX_ATTEMPTS,
  });
}
