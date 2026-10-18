/**
 * Reconnaissance d'images via Gemini Vision (déjà branché Stock Manager).
 * Clé : uniquement serveur (Cloudflare GEMINI_API_KEY via /api/gemini/proxy).
 * Option locale de secours : localStorage gemini_api_key (déconseillé).
 *
 * Usages :
 * - inventaire / liste / objet
 * - reçu d'achat (nouvelles boissons)
 * - photo de casiers → comptage pour le point du jour
 */
import type { Product } from './types';
import {
  findDuplicate,
  parseInventoryText,
  type ScannedLine,
  guessCategoryFromName,
} from './inventoryScan';

const MODEL = 'gemini-2.0-flash';

export type VisionScanMode = 'auto' | 'list' | 'object' | 'receipt' | 'casier';

function getApiKey(): string | null {
  const k = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim();
  if (k) return k;
  try {
    return localStorage.getItem('gemini_api_key')?.trim() || null;
  } catch {
    return null;
  }
}

export function hasVisionApi(): boolean {
  // Proxy serveur toujours tenté ; clé locale = secours hors proxy
  return true;
}

export function setLocalGeminiKey(key: string) {
  localStorage.setItem('gemini_api_key', key.trim());
}

export function clearLocalGeminiKey() {
  localStorage.removeItem('gemini_api_key');
}

async function blobToBase64(blob: Blob): Promise<{ mime: string; data: string }> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const data = btoa(binary);
  const mime = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
  return { mime, data };
}

async function shrinkImage(file: File | Blob, max = 1400): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    let { width, height } = bmp;
    if (width > max || height > max) {
      const s = max / Math.max(width, height);
      width = Math.round(width * s);
      height = Math.round(height * s);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, width, height);
    bmp.close?.();
    return await new Promise((res) => {
      canvas.toBlob((b) => res(b || file), 'image/jpeg', 0.88);
    });
  } catch {
    return file;
  }
}

type VisionItem = {
  name: string;
  quantity?: number;
  unit?: string;
  brand?: string;
  category?: string;
  confidence?: number;
  bottles_per_casier?: number;
  casiers?: number;
  total_bottles?: number;
  unit_price?: number;
  line_total?: number;
};

function toScannedLines(items: VisionItem[], existing: Product[]): ScannedLine[] {
  const results: ScannedLine[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const name = (it.name || it.brand || '').trim();
    if (name.length < 2) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const dup = findDuplicate(name, existing);

    let stock = Math.max(0, Math.round(Number(it.quantity) || 0));
    if (stock === 0 && it.total_bottles) stock = Math.round(Number(it.total_bottles));
    if (stock === 0 && it.casiers && it.bottles_per_casier) {
      stock = Math.round(Number(it.casiers) * Number(it.bottles_per_casier));
    }

    const cost =
      (it.unit_price && Number(it.unit_price) > 0
        ? Math.round(Number(it.unit_price))
        : 0) || (dup ? Number(dup.cost) : 0);

    results.push({
      id: `vis-${results.length}-${Date.now()}`,
      name,
      category: it.category || guessCategoryFromName(name),
      unit: it.unit || (it.casiers ? 'casier' : 'bouteille'),
      stock,
      cost,
      price: dup ? Number(dup.price) : 0,
      min_stock: dup ? Number(dup.min_stock) || 12 : 12,
      matchId: dup?.id ?? null,
      matchName: dup?.name ?? null,
      action: dup ? 'update' : 'create',
      confidence: typeof it.confidence === 'number' ? it.confidence : 0.8,
      raw: JSON.stringify(it),
    });
  }
  return results.slice(0, 80);
}

function extractJsonArray(text: string): VisionItem[] {
  if (!text) return [];
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.items)) return parsed.items;
  } catch {
    /* */
  }
  const m = cleaned.match(/\[[\s\S]*\]/);
  if (m) {
    try {
      const parsed = JSON.parse(m[0]);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* */
    }
  }
  return [];
}

async function callGemini(
  image: Blob,
  prompt: string,
  onProgress?: (pct: number, status: string) => void,
): Promise<string> {
  onProgress?.(15, 'Préparation image…');
  const small = await shrinkImage(image);
  const { mime, data } = await blobToBase64(small);
  onProgress?.(40, 'Analyse Gemini…');

  // 1) Proxy serveur (recommandé)
  try {
    let authHeader = '';
    try {
      const { supabase } = await import('./supabase');
      const { data: sess } = await supabase.auth.getSession();
      if (sess?.session?.access_token) {
        authHeader = `Bearer ${sess.session.access_token}`;
      }
    } catch { /* */ }

    const res = await fetch('/api/gemini/proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({
        prompt,
        model: MODEL,
        mime,
        image: data,
        temperature: 0.15,
        maxOutputTokens: 4096,
      }),
    });
    const raw = await res.text();
    if (res.ok) {
      onProgress?.(90, 'Réponse reçue…');
      try {
        const j = JSON.parse(raw);
        const text =
          j?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') ||
          j?.text ||
          '';
        if (text) return String(text);
      } catch {
        if (raw) return raw;
      }
    }
    // si 503 (clé absente) → fallback local
    if (res.status !== 503 && res.status !== 401) {
      throw new Error(`Gemini proxy ${res.status}: ${raw.slice(0, 180)}`);
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Gemini proxy')) throw e;
  }

  // 2) Secours local (déconseillé — à retirer une fois GEMINI_API_KEY configurée)
  const key = getApiKey();
  if (!key) {
    throw new Error(
      'Analyse IA indisponible. Configurez GEMINI_API_KEY sur Cloudflare Pages (secret serveur).',
    );
  }
  onProgress?.(50, 'Analyse Gemini (local)…');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const body = {
    contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime, data } }] }],
    generationConfig: { temperature: 0.15, maxOutputTokens: 4096 },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
  });
  const errText = await res.text();
  if (!res.ok) {
    if (res.status === 400 || res.status === 403) {
      throw new Error('Clé Gemini invalide ou refusée. Vérifiez la clé API.');
    }
    throw new Error(`Gemini erreur ${res.status}: ${errText.slice(0, 180)}`);
  }
  onProgress?.(90, 'Réponse reçue…');
  try {
    const j = JSON.parse(errText);
    return (
      j?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') ||
      ''
    );
  } catch {
    return errText;
  }
}

const LIST_PROMPT = `Tu analyses une photo d'inventaire / liste de produits (boissons de maquis, bar, restaurant en Côte d'Ivoire).
Réponds UNIQUEMENT un JSON array, sans markdown :
[{"name":"nom produit","quantity":12,"unit":"bouteille","category":"Bière","confidence":0.9,"brand":"marque"}]
Règles:
- name en français, marque + format si visible (ex. Bock 66 60cl)
- quantity = nombre visible (casiers convertis en bouteilles si possible)
- unit = bouteille, casier, pack, kg, unité
- category = Bière, Soft, Eau, Spiritueux, Vin, Grillade, Autre
- Maximum 60 items`;

const OBJECT_PROMPT = `Tu identifies les produits sur cette photo (boissons, casiers, packs).
Réponds UNIQUEMENT un JSON array:
[{"name":"nom","quantity":1,"unit":"bouteille","category":"Bière","confidence":0.85,"brand":""}]
Français. Pas de markdown.`;

const RECEIPT_PROMPT = `Tu analyses un REÇU / FACTURE / ticket d'achat de boissons (fournisseur, dépôt, supermarché en Afrique de l'Ouest).
Extrais chaque ligne produit achetée.
Réponds UNIQUEMENT un JSON array, sans markdown :
[{"name":"nom produit","quantity":24,"unit":"bouteille","category":"Bière","unit_price":400,"line_total":9600,"confidence":0.9,"casiers":2,"bottles_per_casier":12,"total_bottles":24}]
Règles:
- quantity / total_bottles = quantités achetées à ajouter au stock
- unit_price en FCFA si visible
- Si casier de 12 ou 24, renseigne bottles_per_casier et total_bottles
- Ignore totaux généraux, TVA, horaires, adresses
- Maximum 50 lignes produits`;

const CASIER_PROMPT = `Tu analyses une photo de CASIERS / bouteilles de boissons (maquis, bar).
Compte ce qui est visible pour le POINT DU JOUR / inventaire terrain.
Réponds UNIQUEMENT un JSON array, sans markdown :
[{"name":"nom ou type de boisson","quantity":36,"unit":"bouteille","category":"Bière","casiers":3,"bottles_per_casier":12,"total_bottles":36,"confidence":0.85}]
Règles:
- Estime le nombre de casiers et de bouteilles par type si plusieurs marques
- bottles_per_casier = 12 ou 24 si reconnaissable, sinon estime
- total_bottles = casiers × bottles_per_casier (ou compte unitaire)
- quantity = total_bottles
- Si marque illisible, utilise une description (ex. "Casier bière brune")
- Maximum 30 entrées`;

function promptFor(mode: VisionScanMode): string {
  switch (mode) {
    case 'object':
      return OBJECT_PROMPT;
    case 'receipt':
      return RECEIPT_PROMPT;
    case 'casier':
      return CASIER_PROMPT;
    case 'list':
    case 'auto':
    default:
      return LIST_PROMPT;
  }
}

/**
 * Analyse image avec Gemini selon le mode (inventaire, reçu, casiers).
 */
export async function recognizeInventoryVision(
  file: File | Blob,
  existing: Product[],
  mode: VisionScanMode = 'auto',
  onProgress?: (pct: number, status: string) => void,
): Promise<{ lines: ScannedLine[]; rawText: string; engine: 'gemini' }> {
  const text = await callGemini(file, promptFor(mode), onProgress);
  let items = extractJsonArray(text);
  if (items.length === 0) {
    const parsed = parseInventoryText(text, existing);
    if (parsed.length) {
      return { lines: parsed, rawText: text, engine: 'gemini' };
    }
  }
  const lines = toScannedLines(items, existing);
  onProgress?.(100, 'Terminé');
  return { lines, rawText: text, engine: 'gemini' };
}

/** Alias explicite reçu d'achat */
export async function recognizeReceiptVision(
  file: File | Blob,
  existing: Product[],
  onProgress?: (pct: number, status: string) => void,
) {
  return recognizeInventoryVision(file, existing, 'receipt', onProgress);
}

/** Alias explicite comptage casiers / point */
export async function recognizeCasierVision(
  file: File | Blob,
  existing: Product[],
  onProgress?: (pct: number, status: string) => void,
) {
  return recognizeInventoryVision(file, existing, 'casier', onProgress);
}
