/**
 * Taux de change — API listée sur API Vault (Currency-api / fawazahmed0)
 * Gratuit, sans clé, CORS OK. Source: https://github.com/fawazahmed0/currency-api
 */
const CDN = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies';

export type RateSnapshot = {
  base: string;
  date?: string;
  xofPerUsd: number | null;
  xofPerEur: number | null;
  usdPerXof: number | null;
  eurPerXof: number | null;
  updatedAt: string;
};

let cache: { at: number; data: RateSnapshot } | null = null;
const TTL_MS = 6 * 60 * 60 * 1000; // 6 h

export async function fetchXofRates(): Promise<RateSnapshot> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;

  const empty: RateSnapshot = {
    base: 'xof',
    xofPerUsd: null,
    xofPerEur: null,
    usdPerXof: null,
    eurPerXof: null,
    updatedAt: new Date().toISOString(),
  };

  try {
    const [usdRes, eurRes] = await Promise.all([
      fetch(`${CDN}/usd.json`),
      fetch(`${CDN}/eur.json`),
    ]);
    if (!usdRes.ok || !eurRes.ok) return empty;
    const usdJson = await usdRes.json();
    const eurJson = await eurRes.json();
    const xofFromUsd = Number(usdJson?.usd?.xof);
    const xofFromEur = Number(eurJson?.eur?.xof);
    const data: RateSnapshot = {
      base: 'xof',
      date: usdJson?.date,
      xofPerUsd: Number.isFinite(xofFromUsd) ? xofFromUsd : null,
      xofPerEur: Number.isFinite(xofFromEur) ? xofFromEur : null,
      usdPerXof: Number.isFinite(xofFromUsd) && xofFromUsd > 0 ? 1 / xofFromUsd : null,
      eurPerXof: Number.isFinite(xofFromEur) && xofFromEur > 0 ? 1 / xofFromEur : null,
      updatedAt: new Date().toISOString(),
    };
    cache = { at: Date.now(), data };
    return data;
  } catch {
    return empty;
  }
}

/** QR code image URL — API Vault: goqr.me (gratuit, sans clé) */
export function qrCodeImageUrl(text: string, size = 200): string {
  const data = encodeURIComponent(text.slice(0, 1800));
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${data}`;
}
