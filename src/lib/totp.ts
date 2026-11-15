/** TOTP minimal (RFC 6238) — sans dépendance externe */

function base32Decode(input: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = input.replace(/=+$/, '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const c of cleaned) {
    const val = alphabet.indexOf(c);
    if (val < 0) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

function base32Encode(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    out += alphabet[parseInt(chunk, 2)];
  }
  return out;
}

export function generateTotpSecret(bytesLen = 20): string {
  const arr = new Uint8Array(bytesLen);
  crypto.getRandomValues(arr);
  return base32Encode(arr);
}

async function hmacSha1(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return new Uint8Array(sig);
}

export async function generateTotp(secretBase32: string, step = 30): Promise<string> {
  const key = base32Decode(secretBase32);
  const counter = Math.floor(Date.now() / 1000 / step);
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint32(0, Math.floor(counter / 0x100000000));
  view.setUint32(4, counter >>> 0);
  const h = await hmacSha1(key, new Uint8Array(buf));
  const offset = h[h.length - 1] & 0x0f;
  const code =
    ((h[offset] & 0x7f) << 24) |
    ((h[offset + 1] & 0xff) << 16) |
    ((h[offset + 2] & 0xff) << 8) |
    (h[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

export async function verifyTotp(secretBase32: string, token: string, window = 1): Promise<boolean> {
  const clean = (token || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) return false;
  const step = 30;
  const now = Math.floor(Date.now() / 1000 / step);
  for (let w = -window; w <= window; w++) {
    const counter = now + w;
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setUint32(0, Math.floor(counter / 0x100000000));
    view.setUint32(4, counter >>> 0);
    const key = base32Decode(secretBase32);
    const h = await hmacSha1(key, new Uint8Array(buf));
    const offset = h[h.length - 1] & 0x0f;
    const code =
      ((h[offset] & 0x7f) << 24) |
      ((h[offset + 1] & 0xff) << 16) |
      ((h[offset + 2] & 0xff) << 8) |
      (h[offset + 3] & 0xff);
    const expected = String(code % 1_000_000).padStart(6, '0');
    if (expected === clean) return true;
  }
  return false;
}

export function otpauthUrl(secret: string, accountName: string, issuer = 'GESMAK'): string {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    `otpauth://totp/${label}?${params.toString()}`
  )}`;
}
