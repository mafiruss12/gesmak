import type { Product } from './types';

export interface ScannedLine {
  id: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  cost: number;
  price: number;
  min_stock: number;
  matchId: string | null;
  matchName: string | null;
  action: 'update' | 'create' | 'skip';
  confidence: number;
  raw: string;
  /** Nombre de casiers / packs achetés (reçu) */
  package_count?: number;
  /** Bouteilles par casier ou unités par pack (6, 12, 24, 32…) */
  units_per_package?: number;
  /** add = réappro (stock += qty) ; set = inventaire (stock = qty) */
  stock_mode?: 'add' | 'set';
}

/** Normalise pour détecter doublons */
export function normalizeProductKey(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(bouteille|bout|bt|cl|ml|casier|csr|x|kg|m3|m2|sac|barre|u|unite|unité)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findDuplicate(name: string, products: Product[]): Product | null {
  const key = normalizeProductKey(name);
  if (!key) return null;
  let best: Product | null = null;
  let bestScore = 0;
  for (const p of products) {
    const pk = normalizeProductKey(p.name);
    if (!pk) continue;
    if (pk === key) return p;
    if (pk.includes(key) || key.includes(pk)) {
      const score = Math.min(pk.length, key.length) / Math.max(pk.length, key.length);
      if (score > bestScore && score >= 0.55) {
        bestScore = score;
        best = p;
      }
    }
  }
  return best;
}

export function guessCategoryFromName(name: string): string {
  const n = name.toLowerCase();
  if (/ciment|sable|gravier|fer|acier|brique|parpaing|beton|béton|tuyau|cable|câble|peinture|carrelage/.test(n))
    return 'BTP';
  if (/coca|fanta|sprite|soda|eau|jus|boisson|malta|tonic|schweppes/.test(n)) return 'Soft';
  if (/vin|whisky|vodka|ricard|pastis|gin|rhum|liqueur/.test(n)) return 'Spiritueux';
  if (/biere|bière|bock|castel|flag|beaufort|doppel|desperados|heineken|guinness|amate|ivoiro/.test(n))
    return 'Alcool';
  if (/chaise|table|bache|bâche|sono|nappe|tente/.test(n)) return 'Location';
  return 'Autre';
}

function guessUnit(name: string, raw: string): string {
  const t = `${name} ${raw}`.toLowerCase();
  if (/65\s*cl|66/.test(t)) return 'Bouteille 65cl';
  if (/50\s*cl/.test(t)) return 'Bouteille 50cl';
  if (/33\s*cl|25\s*cl/.test(t)) return 'Bouteille 33cl';
  if (/casier/.test(t)) return 'Casier';
  if (/\bkg\b/.test(t)) return 'kg';
  if (/m[³3]|m3/.test(t)) return 'm³';
  if (/\bsac\b/.test(t)) return 'sac';
  return 'unité';
}

/** Parse texte OCR → lignes produits (tous établissements) */
export function parseInventoryText(text: string, existing: Product[]): ScannedLine[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1);

  const results: ScannedLine[] = [];
  const seen = new Set<string>();

  for (const raw of lines) {
    if (/^(cat[eé]gorie|produit|marque|format|qte|qt[eé]|stock|prix|valeur|casier|n[°o]|total|désignation|designation|quantit)/i.test(raw))
      continue;
    if (/^[\d\s.,€$fcfa\-_=]+$/i.test(raw)) continue;
    if (raw.length < 2) continue;

    const nums = [...raw.matchAll(/(\d+(?:[.,]\d+)?)/g)].map((m) =>
      parseFloat(m[1].replace(',', '.')),
    );
    let namePart = raw
      .replace(/(\d+(?:[.,]\d+)?)/g, ' ')
      .replace(/[|•·]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    namePart = namePart.replace(/^[-–—:\s]+|[-–—:\s]+$/g, '');
    if (namePart.length < 2) continue;
    if (namePart.length > 80) namePart = namePart.slice(0, 80);

    const key = normalizeProductKey(namePart);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    let stock = 0;
    let cost = 0;
    let price = 0;
    const candidates = nums.filter((n) => !Number.isNaN(n));
    for (const n of candidates) {
      if (n >= 1 && n <= 500 && stock === 0) stock = Math.round(n);
      else if (n >= 100 && n <= 500000) {
        if (cost === 0) cost = Math.round(n);
        else if (price === 0) price = Math.round(n);
      }
    }
    if (stock === 0 && candidates.length === 1 && candidates[0] <= 500) {
      stock = Math.round(candidates[0]);
    }

    const dup = findDuplicate(namePart, existing);
    const conf =
      (stock > 0 ? 0.35 : 0.15) +
      (namePart.length >= 3 ? 0.35 : 0.1) +
      (dup ? 0.2 : 0.1) +
      (cost > 0 || price > 0 ? 0.1 : 0);

    results.push({
      id: `scan-${results.length}-${Date.now()}`,
      name: namePart,
      category: guessCategoryFromName(namePart),
      unit: guessUnit(namePart, raw),
      stock,
      cost: cost || (dup ? Number(dup.cost) : 0),
      price: price || (dup ? Number(dup.price) : 0),
      min_stock: dup ? Number(dup.min_stock) || 12 : 12,
      matchId: dup?.id ?? null,
      matchName: dup?.name ?? null,
      action: dup ? 'update' : 'create',
      confidence: Math.min(0.98, conf),
      raw,
    });
  }

  return results.slice(0, 100);
}

/** Réduit / normalise l’image pour un OCR plus fiable (max ~1600px) */
export async function prepareImageForOcr(file: File | Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1600;
    let { width, height } = bitmap;
    if (width > maxSide || height > maxSide) {
      const scale = maxSide / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    // léger contraste
    try {
      const img = ctx.getImageData(0, 0, width, height);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const v = g < 128 ? Math.max(0, g * 0.85) : Math.min(255, g * 1.15);
        d[i] = d[i + 1] = d[i + 2] = v;
      }
      ctx.putImageData(img, 0, 0);
    } catch {
      /* ignore */
    }
    bitmap.close?.();
    return await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b || file), 'image/jpeg', 0.92);
    });
  } catch {
    return file;
  }
}

/**
 * OCR français (fallback anglais) — chemins CDN pour Vite/PWA/APK.
 */
/**
 * OCR français (+ anglais) — d’abord chemins par défaut tesseract.js, puis CDN de secours.
 */
export async function runOcrFrench(
  file: File | Blob,
  onProgress?: (pct: number, status: string) => void,
): Promise<string> {
  const prepared = await prepareImageForOcr(file);
  const { createWorker } = await import('tesseract.js');

  const tryRecognize = async (
    worker: Awaited<ReturnType<typeof createWorker>>,
  ): Promise<string> => {
    try {
      await worker.setParameters({
        tessedit_pageseg_mode: '6' as any, // bloc uniforme
        preserve_interword_spaces: '1',
      });
    } catch {
      /* ignore */
    }
    const { data } = await worker.recognize(prepared);
    return (data.text || '').trim();
  };

  // 1) Chemins par défaut (souvent plus fiables que des URL hardcodées)
  try {
    onProgress?.(3, 'Chargement OCR…');
    const worker = await createWorker('fra+eng', 1, {
      logger: (m: { status?: string; progress?: number }) => {
        if (typeof m.progress === 'number') {
          onProgress?.(
            Math.round(m.progress * 100),
            m.status === 'recognizing text' ? 'Lecture du texte…' : m.status || '…',
          );
        }
      },
    } as any);
    let out = await tryRecognize(worker);
    if (out.length < 3) {
      onProgress?.(50, 'Essai anglais…');
      await worker.reinitialize('eng');
      out = (await tryRecognize(worker)) || out;
    }
    await worker.terminate();
    if (out.length >= 2) return out;
  } catch (e) {
    console.warn('[OCR] défaut échoué', e);
  }

  // 2) Secours CDN explicite
  const workerOpts = (langPath: string, corePath: string) => ({
    workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
    corePath,
    langPath,
    logger: (m: { status?: string; progress?: number }) => {
      if (typeof m.progress === 'number') {
        onProgress?.(
          Math.round(m.progress * 100),
          m.status === 'recognizing text' ? 'Lecture du texte…' : m.status || '…',
        );
      }
    },
  });
  const cores = [
    'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd.wasm.js',
    'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core.wasm.js',
  ];
  const langs = [
    'https://tessdata.projectnaptha.com/4.0.0_fast',
    'https://tessdata.projectnaptha.com/4.0.0',
  ];

  let lastErr: unknown = null;
  for (const corePath of cores) {
    for (const langPath of langs) {
      let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
      try {
        onProgress?.(2, 'Chargement OCR (secours)…');
        worker = await createWorker('fra', 1, workerOpts(langPath, corePath) as any);
        let out = await tryRecognize(worker);
        if (out.length < 3) {
          await worker.reinitialize('eng');
          out = (await tryRecognize(worker)) || out;
        }
        await worker.terminate();
        if (out.length >= 2) return out;
      } catch (e) {
        lastErr = e;
        try {
          await worker?.terminate();
        } catch {
          /* */
        }
      }
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error(
        'Impossible de démarrer l’OCR. Vérifiez la connexion internet (téléchargement du moteur) puis réessayez avec une photo nette et bien éclairée.',
      );
}
