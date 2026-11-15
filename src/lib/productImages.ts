/**
 * Images produits — priorité :
 * 1) image du produit (personnalisée)
 * 2) catalogue global AU GBAISSAI CHEZ RCO (partagé à tous les maquis)
 * 3) règles Unsplash de secours
 *
 * Ne jamais vider product_image_defaults ni les image_url de AU GBAISSAI CHEZ RCO.
 */
import { supabase } from '@/lib/supabase';

type Rule = { keys: string[]; url: string };

/** Images HD style Makaya (photo produit isolée sur fond clair) */
const IMG = {
  beerGreen: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=256&h=256&fit=crop',
  beerBottle: 'https://images.unsplash.com/photo-1535958636474-b021ee852bba?w=256&h=256&fit=crop',
  beerCan: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=256&h=256&fit=crop',
  heineken: 'https://images.unsplash.com/photo-1618885472179-5e39196df9fe?w=256&h=256&fit=crop',
  guinness: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=256&h=256&fit=crop',
  corona: 'https://images.unsplash.com/photo-1615880484746-a134be9a0eaa?w=256&h=256&fit=crop',
  sodaGreen: 'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=256&h=256&fit=crop',
  sodaOrange: 'https://images.unsplash.com/photo-1624517452488-337a51a5a0f0?w=256&h=256&fit=crop',
  sodaCan: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=256&h=256&fit=crop',
  water: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=256&h=256&fit=crop',
  energy: 'https://images.unsplash.com/photo-1622543925917-763c34d1a951?w=256&h=256&fit=crop',
  wine: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=256&h=256&fit=crop',
  spirits: 'https://images.unsplash.com/photo-1514362545857-3bc16549766b?w=256&h=256&fit=crop',
  whiskey: 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=256&h=256&fit=crop',
  vodka: 'https://images.unsplash.com/photo-1618885472179-5e39196df9fe?w=256&h=256&fit=crop',
};

const RULES: Rule[] = [
  { keys: ['heineken'], url: IMG.heineken },
  { keys: ['guinness', 'malta'], url: IMG.guinness },
  { keys: ['corona'], url: IMG.corona },
  { keys: ['desperados', 'despe'], url: IMG.beerCan },
  { keys: ['beaufort', 'beauford', 'bock', 'castel', 'flag', 'booster', 'racine', 'dopel', 'doppel', 'budweiser', 'bavaria'], url: IMG.beerGreen },
  { keys: ['youzou', 'youki', 'sucrerie', 'ivoire', 'chill', 'kunja'], url: IMG.sodaGreen },
  { keys: ['orangina'], url: IMG.sodaOrange },
  { keys: ['coca', 'coke', 'wordcola'], url: IMG.sodaCan },
  { keys: ['fanta', 'sprite', 'mirinda', 'soda', 'gazeuse'], url: IMG.sodaGreen },
  { keys: ['awa', 'akwaba', 'eau', 'water', 'mineral'], url: IMG.water },
  { keys: ['énergie', 'energie', 'energy', 'boom', 'rinoh', '3x', 'bbl'], url: IMG.energy },
  { keys: ['ballantine', 'whisky', 'whiskey'], url: IMG.whiskey },
  { keys: ['absolut', 'vodka'], url: IMG.vodka },
  { keys: ['bailey', 'tequilla', 'tequila', 'gin', 'bombay'], url: IMG.spirits },
  { keys: ['vin', 'wine', 'baron', 'arignac'], url: IMG.wine },
  { keys: ['bière', 'biere', 'beer'], url: IMG.beerBottle },
];

const CATEGORY_URL: Record<string, string> = {
  bière: IMG.beerBottle,
  biere: IMG.beerBottle,
  soda: IMG.sodaGreen,
  boisson: IMG.sodaGreen,
  eau: IMG.water,
  énergie: IMG.energy,
  energie: IMG.energy,
  vin: IMG.wine,
  spiritueux: IMG.spirits,
  alcool: IMG.spirits,
};

/** Alias facture dépôt → clé catalogue RCO */
const DEPOT_ALIASES: Record<string, string[]> = {
  bock65: ['bock66', 'bock'],
  bock100: ['bock66', 'bock'],
  beaufort50: ['beauford50cl', 'beauford50', 'beaufort50cl'],
  beaufort33: ['beauford33cl', 'beauford33', 'beaufort33cl'],
  castel50: ['castel33cl', 'castel'],
  castel33: ['castel33cl', 'castel'],
  racine50: ['racinebierre', 'racine'],
  racinefort: ['racinefortbierre', 'racinefort'],
  dopel50: ['dopelbiereslocales', 'dopel'],
  dopelenergie: ['codisenergie', 'energieboomcanette'],
  orangina60: ['orangina'],
  orangina33: ['orangina'],
  chill: ['chill'],
  guinness65: ['guinness'],
  guinness33: ['guinness'],
  desperados33: ['despe', 'desperados'],
  heineken33: ['heineken'],
  rinoh: ['rhino'],
  rhinoh: ['rhino'],
  maltaguinness: ['guinness'],
};

let globalCatalog: Map<string, string> = new Map();
let catalogLoaded = false;
let catalogPromise: Promise<void> | null = null;

export function normalizeProductKey(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function isValidImageSrc(url: string | null | undefined): boolean {
  if (!url || url.length < 8) return false;
  return /^https?:\/\//i.test(url) || url.startsWith('data:image');
}

function putCatalog(key: string, url: string) {
  if (!isValidImageSrc(url)) return;
  const k = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (k.length >= 3) globalCatalog.set(k, url);
}

/** Force un rechargement du catalogue (après sync admin) */
export function resetProductImageCatalogCache() {
  catalogLoaded = false;
  catalogPromise = null;
  globalCatalog = new Map();
}

export async function ensureProductImageCatalog(): Promise<void> {
  if (catalogLoaded && globalCatalog.size > 0) return;
  if (catalogPromise) return catalogPromise;
  catalogPromise = (async () => {
    try {
      // 1) Catalogue partagé AU GBAISSAI CHEZ RCO — prioritaire pour tous les maquis
      const { data: defaults, error } = await supabase
        .from('product_image_defaults')
        .select('name_key, name, image_url');
      if (error) {
        console.warn('[productImages] defaults', error.message);
      }
      for (const r of defaults || []) {
        if (!isValidImageSrc(r.image_url)) continue;
        putCatalog(r.name_key || '', r.image_url);
        putCatalog(normalizeProductKey(r.name), r.image_url);
        // variantes sans chiffres (castel33cl → castel)
        const bare = normalizeProductKey(r.name).replace(/\d+/g, '');
        if (bare.length >= 4 && !globalCatalog.has(bare)) putCatalog(bare, r.image_url);
      }

      // 2) Images de mon établissement (personnalisées) — n’écrasent PAS le catalogue RCO
      const { data } = await supabase
        .from('products')
        .select('name, image_url')
        .not('image_url', 'is', null);
      for (const r of data || []) {
        if (!isValidImageSrc(r.image_url)) continue;
        const key = normalizeProductKey(r.name);
        if (key.length >= 3 && !globalCatalog.has(key)) putCatalog(key, r.image_url);
      }
    } catch (e) {
      console.warn('[productImages] load failed', e);
    }
    catalogLoaded = true;
  })();
  return catalogPromise;
}

export function applyDefaultImagesToProducts<T extends { name: string; image_url?: string | null; category?: string | null }>(
  products: T[],
): T[] {
  return products.map((p) => {
    if (isValidImageSrc(p.image_url)) return p;
    const fromCatalog = lookupCatalogImage(p.name);
    if (fromCatalog) return { ...p, image_url: fromCatalog };
    const name = (p.name || '').toLowerCase();
    for (const rule of RULES) {
      if (rule.keys.some((k) => name.includes(k))) return { ...p, image_url: rule.url };
    }
    const cat = String((p as { category?: string | null }).category || '').toLowerCase();
    for (const [k, url] of Object.entries(CATEGORY_URL)) {
      if (cat.includes(k)) return { ...p, image_url: url };
    }
    if (/bière|biere|beer|bock|castel|beaufort|flag|guinness|heineken/.test(name + ' ' + cat)) {
      return { ...p, image_url: IMG.beerBottle };
    }
    if (/soda|boisson|jus|eau|énergie|energie/.test(name + ' ' + cat)) {
      return { ...p, image_url: IMG.sodaGreen };
    }
    return { ...p, image_url: IMG.beerBottle };
  });
}

export function lookupCatalogImage(name?: string | null): string | null {
  if (!name) return null;
  const key = normalizeProductKey(name);
  if (key.length < 2) return null;
  if (globalCatalog.has(key)) return globalCatalog.get(key)!;

  // correspondance partielle (castel ↔ castel33cl, fanta ↔ fanta…)
  let best: { score: number; url: string } | null = null;
  for (const [k, url] of globalCatalog) {
    if (k === key) return url;
    if (k.includes(key) || key.includes(k)) {
      const score = Math.min(k.length, key.length);
      if (score >= 4 && (!best || score > best.score)) best = { score, url };
    }
  }
  if (best) return best.url;

  // sans chiffres
  const bare = key.replace(/\d+/g, '');
  if (bare.length >= 4 && globalCatalog.has(bare)) return globalCatalog.get(bare)!;
  for (const [k, url] of globalCatalog) {
    const kb = k.replace(/\d+/g, '');
    if (bare.length >= 4 && (kb === bare || kb.includes(bare) || bare.includes(kb))) return url;
  }
  // alias facture dépôt
  const aliases = DEPOT_ALIASES[key] || DEPOT_ALIASES[bare] || [];
  for (const a of aliases) {
    if (globalCatalog.has(a)) return globalCatalog.get(a)!;
    for (const [k, url] of globalCatalog) {
      if (k.includes(a) || a.includes(k)) return url;
    }
  }
  return null;
}

export function registerCatalogImage(name: string, imageUrl: string) {
  if (!isValidImageSrc(imageUrl)) return;
  putCatalog(normalizeProductKey(name), imageUrl);
}

export function categoryEmoji(category?: string | null, name?: string): string {
  const t = `${category || ''} ${name || ''}`.toLowerCase();
  if (/bière|biere|beer|flag|castel|bock|beaufort|beauford/.test(t)) return '🍺';
  if (/soda|coca|fanta|sprite|chill/.test(t)) return '🥤';
  if (/eau|water/.test(t)) return '💧';
  if (/énergie|energie|energy|boom/.test(t)) return '⚡';
  if (/alcool|whisky|rhum/.test(t)) return '🥃';
  return '📦';
}

export function resolveProductImage(opts: {
  name?: string | null;
  category?: string | null;
  image_url?: string | null;
}): string | null {
  if (isValidImageSrc(opts.image_url)) return opts.image_url!;
  const fromCatalog = lookupCatalogImage(opts.name);
  if (fromCatalog) return fromCatalog;
  const name = (opts.name || '').toLowerCase();
  for (const rule of RULES) {
    if (rule.keys.some((k) => name.includes(k))) return rule.url;
  }
  const cat = (opts.category || '').toLowerCase();
  for (const [k, url] of Object.entries(CATEGORY_URL)) {
    if (cat.includes(k)) return url;
  }
  // Dernier recours : image générique boisson (stock initial visible)
  if (/bière|biere|beer|bock|castel|beaufort|flag|guinness|heineken/.test(name + ' ' + cat)) {
    return IMG.beerBottle;
  }
  if (/soda|boisson|jus|eau|énergie|energie/.test(name + ' ' + cat)) {
    return IMG.sodaGreen;
  }
  return IMG.beerBottle;
}
