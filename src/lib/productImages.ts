/**
 * Images produits — priorité :
 * 1) image du produit (personnalisée)
 * 2) catalogue global product_image_defaults (partagé à tous les maquis)
 * 3) photos officielles vérifiées par boisson & format (Solibra CI, Brassivoire CI, GIG CI, Sokaf, OpenFoodFacts)
 *
 * Ne jamais vider product_image_defaults ni les image_url de AU GBAISSAI CHEZ RCO.
 */
import { supabase } from '@/lib/supabase';

/** URLs produits vérifiées HTTP 200 */
const VERIFIED = {
  // Beaufort
  beaufort25: 'https://solibrachezvous.com/wp-content/uploads/2020/04/carton-beaufort-430x430.jpg',
  beaufort33: 'https://solibrachezvous.com/wp-content/uploads/2020/04/c33beaufort50cl_vc-430x430.jpg',
  beaufort50: 'https://solibrachezvous.com/wp-content/uploads/2020/04/c50beaufort50cl_vc-430x430.jpg',
  beaufortCan: 'https://solibrachezvous.com/wp-content/uploads/2023/01/beaufort-33-canette-430x430.jpg',
  // Bock
  bock25: 'https://solibrachezvous.com/wp-content/uploads/2020/04/bock33cl-430x430.jpg',
  bock50: 'https://solibrachezvous.com/wp-content/uploads/2020/04/bock50cl-430x430.jpg',
  bock65: 'https://solibrachezvous.com/wp-content/uploads/2020/04/bock65cl-430x430.jpg',
  bock100: 'https://solibrachezvous.com/wp-content/uploads/2020/04/bock100cl-430x430.jpg',
  bockCan: 'https://solibrachezvous.com/wp-content/uploads/2020/04/bock50cl-24-430x430.jpg',
  // Castel
  castel33: 'https://solibrachezvous.com/wp-content/uploads/2020/04/castell33-430x430.jpg',
  castel50: 'https://solibrachezvous.com/wp-content/uploads/2020/04/castel50cl-nouveau1-430x430.jpg',
  // Flag, Booster Tequila, Racine, Dopel
  flag: 'https://images.openfoodfacts.org/images/products/611/104/500/0222/front_fr.15.200.jpg',
  boosterTequila: 'https://solibrachezvous.com/wp-content/uploads/2020/04/tequila-30cl-cassier-1-768x768-1-430x430.jpg',
  racine33: 'https://solibrachezvous.com/wp-content/uploads/2022/04/racine33cl-430x430.jpg',
  racine50: 'https://solibrachezvous.com/wp-content/uploads/2021/05/booster-racine-430x430.jpg',
  racineCan: 'https://solibrachezvous.com/wp-content/uploads/2023/01/racine33canette-430x430.jpg',
  racineFort: 'https://solibrachezvous.com/wp-content/uploads/2023/07/racines-fort-430x430.jpg',
  dopel33: 'https://solibrachezvous.com/wp-content/uploads/2021/03/doppel33cl_vc-430x430.jpg',
  dopel50: 'https://solibrachezvous.com/wp-content/uploads/2021/03/doppel65cl_vc-430x430.jpg',
  dopelEnergie: 'https://solibrachezvous.com/wp-content/uploads/2020/04/canettedem-1-430x430.jpg',
  // Brassivoire / Import bières
  guinness33: 'https://solibrachezvous.com/wp-content/uploads/2021/03/guinness33cl_vc-430x430.jpg',
  guinness65: 'https://solibrachezvous.com/wp-content/uploads/2021/03/guinness65cl_vc-1-430x430.jpg',
  guinnessCan: 'https://solibrachezvous.com/wp-content/uploads/2024/09/canetteGuiness-430x430.jpg',
  maltaGuinness: 'https://solibrachezvous.com/wp-content/uploads/2020/04/malta-guinnessa-430x430.jpg',
  heineken: 'https://brassivoire.ci/wp-content/uploads/2024/05/heineken-4-201x300.png',
  desperados: 'https://brassivoire.ci/wp-content/uploads/2024/05/desperados-2-201x300.png',
  ivoire: 'https://brassivoire.ci/wp-content/uploads/2024/09/60cl-Classic-New-1-160x300.png',
  budweiser: 'https://solibrachezvous.com/wp-content/uploads/2020/04/budweiser-carton2-430x430.jpg',
  corona: 'https://solibrachezvous.com/wp-content/uploads/2024/08/vente-430x430.jpg',
  bavaria: 'https://images.openfoodfacts.org/images/products/871/480/001/1426/front_en.6.200.jpg',
  // Sodas & Gazeuses
  youzou30: 'https://solibrachezvous.com/wp-content/uploads/2022/03/YOUZOU30CL-430x430.jpg',
  youzou50: 'https://solibrachezvous.com/wp-content/uploads/2022/03/YOUZOU50CL-430x430.jpg',
  youzouCan: 'https://solibrachezvous.com/wp-content/uploads/2022/06/youzoucanette-1-430x430.jpg',
  youzouPet30: 'https://solibrachezvous.com/wp-content/uploads/2022/03/YOUKI-30CL-PET-430x430.jpg',
  youzouPet15: 'https://solibrachezvous.com/wp-content/uploads/2026/03/YOUZOU-1L-430x430.jpg',
  youki30: 'https://solibrachezvous.com/wp-content/uploads/2020/04/YOUKI-30CL-430x430.jpg',
  youki50: 'https://solibrachezvous.com/wp-content/uploads/2020/04/YOUKI50CL-430x430.jpg',
  youkiPet30: 'https://solibrachezvous.com/wp-content/uploads/2020/04/youki-430x430.jpg',
  youkiPet15: 'https://solibrachezvous.com/wp-content/uploads/2020/04/youki-orange-430x430.jpg',
  orangina30: 'https://solibrachezvous.com/wp-content/uploads/2020/04/ORANGINA-30-CL-430x430.jpg',
  orangina50: 'https://solibrachezvous.com/wp-content/uploads/2020/04/ORANGINA50-430x430.jpg',
  oranginaCan: 'https://solibrachezvous.com/wp-content/uploads/2020/04/orangina33cl-430x430.jpg',
  worldCola30: 'https://solibrachezvous.com/wp-content/uploads/2022/02/WCO-430x430.jpg',
  worldCola50: 'https://solibrachezvous.com/wp-content/uploads/2022/01/worldcola50cl-VC-430x430.jpg',
  worldColaCan: 'https://solibrachezvous.com/wp-content/uploads/2022/02/worldcolacanette33cl-430x430.jpg',
  chill50: 'https://solibrachezvous.com/wp-content/uploads/2020/04/CHILL50-NOUVEAU-430x430.jpg',
  chillCan: 'https://solibrachezvous.com/wp-content/uploads/2026/03/CANETTE-CHILL-430x430.jpg',
  coca: 'https://images.openfoodfacts.org/images/products/544/900/005/4227/front_en.563.200.jpg',
  fanta: 'https://images.openfoodfacts.org/images/products/544/900/001/1527/front_en.376.200.jpg',
  sprite: 'https://images.openfoodfacts.org/images/products/544/900/000/6295/front_fr.11.200.jpg',
  kunja: 'https://brassivoire.ci/wp-content/uploads/2024/10/autre-categ-300x188.jpg',
  // Énergie
  rinoh: 'https://brassivoire.ci/wp-content/uploads/2024/05/rhino-1-201x300.png',
  energy3x: 'https://sokafafrique.com/wp-content/uploads/2023/04/500ml-3x-energy-drink.jpg',
  xxlEnergy: 'https://solibrachezvous.com/wp-content/uploads/2020/04/xxl24-1-430x430.jpg',
  feroxEnergy: 'https://solibrachezvous.com/wp-content/uploads/2026/09/FEROX-CANETTE-1-430x430.jpg',
  energyGeneric: 'https://brassivoire.ci/wp-content/uploads/2024/10/Boissons-energisantes-300x188.jpg',
  // Eaux minérales
  awa: 'https://images.openfoodfacts.org/images/products/618/110/036/0035/front_fr.24.200.jpg',
  akwaba: 'https://gig.ci/wp-content/uploads/2025/01/AkwabaO_1-768x767.png',
  // Vins & Spiritueux
  valpierre50: 'https://solibrachezvous.com/wp-content/uploads/2020/04/valpierre50cl-430x430.jpg',
  valpierre100: 'https://solibrachezvous.com/wp-content/uploads/2020/04/VALPIERRE-430x430.jpg',
  baronArignac: 'https://images.openfoodfacts.org/images/products/326/328/634/2593/front_fr.11.200.jpg',
  baileys: 'https://images.openfoodfacts.org/images/products/501/101/310/0156/front_en.155.200.jpg',
  ballantines: 'https://images.openfoodfacts.org/images/products/501/010/611/1956/front_fr.38.200.jpg',
  absolutVodka: 'https://images.openfoodfacts.org/images/products/731/204/001/7683/front_en.31.200.jpg',
  sombreros50: 'https://solibrachezvous.com/wp-content/uploads/2023/10/sombreros-casier-50cl-430x430.jpg',
  sombreros33: 'https://solibrachezvous.com/wp-content/uploads/2023/10/sombreros-casier-33cl-430x430.jpg',
};

function matchDrinkPhoto(nameRaw: string, categoryRaw: string): string | null {
  const n = (nameRaw || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const cat = (categoryRaw || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const isCan = /canette|can\b|boite/.test(n);
  const isPet = /\bpet\b|plastique/.test(n);

  // Beaufort
  if (/beaufort|beauford/.test(n)) {
    if (isCan) return VERIFIED.beaufortCan;
    if (/25/.test(n)) return VERIFIED.beaufort25;
    if (/33/.test(n)) return VERIFIED.beaufort33;
    return VERIFIED.beaufort50;
  }
  // Bock
  if (/\bbock\b/.test(n)) {
    if (isCan) return VERIFIED.bockCan;
    if (/100|1\s*l\b/.test(n)) return VERIFIED.bock100;
    if (/65|66/.test(n)) return VERIFIED.bock65;
    if (/50/.test(n)) return VERIFIED.bock50;
    return VERIFIED.bock25;
  }
  // Castel
  if (/castel/.test(n)) {
    return /50|65/.test(n) ? VERIFIED.castel50 : VERIFIED.castel33;
  }
  // Flag
  if (/\bflag\b/.test(n)) return VERIFIED.flag;
  // Booster Tequila
  if (/booster/.test(n)) return VERIFIED.boosterTequila;
  // Racine / Racines Fort
  if (/racine/.test(n)) {
    if (/fort/.test(n)) return VERIFIED.racineFort;
    if (isCan) return VERIFIED.racineCan;
    if (/33|30/.test(n)) return VERIFIED.racine33;
    return VERIFIED.racine50;
  }
  // Dopel Energie vs Dopel bière
  if (/dopel|doppel/.test(n)) {
    if (/energie|energy|malt/.test(n)) return VERIFIED.dopelEnergie;
    return /33/.test(n) ? VERIFIED.dopel33 : VERIFIED.dopel50;
  }
  // Malta Guinness avant Guinness
  if (/malta/.test(n)) return VERIFIED.maltaGuinness;
  // Guinness
  if (/guinness|guiness/.test(n)) {
    if (isCan) return VERIFIED.guinnessCan;
    if (/65|60/.test(n)) return VERIFIED.guinness65;
    return VERIFIED.guinness33;
  }
  // Heineken / Desperados / Budweiser / Corona / Bavaria / Ivoire
  if (/heineken/.test(n)) return VERIFIED.heineken;
  if (/desperados|despe/.test(n)) return VERIFIED.desperados;
  if (/budweiser/.test(n)) return VERIFIED.budweiser;
  if (/corona/.test(n)) return VERIFIED.corona;
  if (/bavaria/.test(n)) return VERIFIED.bavaria;
  if (/ivoire/.test(n)) return VERIFIED.ivoire;
  // Youzou
  if (/youzou/.test(n)) {
    if (isCan) return VERIFIED.youzouCan;
    if (isPet || /1[.,]5|1l/.test(n)) {
      return /1[.,]5|1\s*l|100/.test(n) ? VERIFIED.youzouPet15 : VERIFIED.youzouPet30;
    }
    return /50|60/.test(n) ? VERIFIED.youzou50 : VERIFIED.youzou30;
  }
  // Youki Orange
  if (/youki/.test(n)) {
    if (isPet || /1[.,]5|1l/.test(n)) {
      return /1[.,]5|1\s*l|100/.test(n) ? VERIFIED.youkiPet15 : VERIFIED.youkiPet30;
    }
    return /50|60/.test(n) ? VERIFIED.youki50 : VERIFIED.youki30;
  }
  // Orangina
  if (/orangina/.test(n)) {
    if (isCan) return VERIFIED.oranginaCan;
    return /50|60|1[.,]25|1[.,]5/.test(n) ? VERIFIED.orangina50 : VERIFIED.orangina30;
  }
  // World Cola / Sucrerie
  if (/sucrerie|world\s*cola|wordcola/.test(n)) {
    if (isCan) return VERIFIED.worldColaCan;
    return /50|60/.test(n) ? VERIFIED.worldCola50 : VERIFIED.worldCola30;
  }
  // Chill Citron
  if (/\bchill\b/.test(n)) return isCan ? VERIFIED.chillCan : VERIFIED.chill50;
  // Coca-Cola / Fanta / Sprite / Kunja
  if (/coca|coke/.test(n)) return VERIFIED.coca;
  if (/fanta/.test(n)) return VERIFIED.fanta;
  if (/sprite/.test(n)) return VERIFIED.sprite;
  if (/kunja/.test(n)) return VERIFIED.kunja;
  // Énergie (Rinoh, 3X Energy, XXL, Ferox, BBL)
  if (/rinoh|rhino/.test(n)) return VERIFIED.rinoh;
  if (/3x/.test(n)) return VERIFIED.energy3x;
  if (/\bxxl\b/.test(n)) return VERIFIED.xxlEnergy;
  if (/ferox/.test(n)) return VERIFIED.feroxEnergy;
  if (/\bbbl\b|energie|energy|boom/.test(n)) return VERIFIED.energyGeneric;
  // Eaux
  if (/akwaba/.test(n)) return VERIFIED.akwaba;
  if (/\bawa\b|eau|water|mineral/.test(n)) return VERIFIED.awa;
  // Vins & Spiritueux
  if (/baron|arignac/.test(n)) return VERIFIED.baronArignac;
  if (/bailey/.test(n)) return VERIFIED.baileys;
  if (/ballantine|whisky|whiskey/.test(n)) return VERIFIED.ballantines;
  if (/absolut|vodka/.test(n)) return VERIFIED.absolutVodka;
  if (/tequilla|tequila|sombreros/.test(n)) {
    return /33|30/.test(n) ? VERIFIED.sombreros33 : VERIFIED.sombreros50;
  }
  if (/valpierre|\bvin\b|wine/.test(n)) {
    return /100|75|1\s*l/.test(n) ? VERIFIED.valpierre100 : VERIFIED.valpierre50;
  }

  // Fallback par catégorie avec de vraies photos produits
  if (cat.includes('biere') || cat.includes('beer')) return VERIFIED.bock50;
  if (cat.includes('soda') || cat.includes('boisson') || cat.includes('gazeuse')) return VERIFIED.youzou30;
  if (cat.includes('eau')) return VERIFIED.awa;
  if (cat.includes('energie') || cat.includes('energy')) return VERIFIED.energy3x;
  if (cat.includes('vin')) return VERIFIED.valpierre50;
  if (cat.includes('spiritueux') || cat.includes('alcool')) return VERIFIED.ballantines;
  return null;
}

const CATEGORY_URL: Record<string, string> = {
  bière: VERIFIED.bock50,
  biere: VERIFIED.bock50,
  soda: VERIFIED.youzou30,
  boisson: VERIFIED.youzou30,
  eau: VERIFIED.awa,
  énergie: VERIFIED.energy3x,
  energie: VERIFIED.energy3x,
  vin: VERIFIED.valpierre50,
  spiritueux: VERIFIED.ballantines,
  alcool: VERIFIED.ballantines,
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
  if (url.includes('images.unsplash.com')) return false;
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
        const bare = normalizeProductKey(r.name).replace(/\d+/g, '');
        if (bare.length >= 4 && !globalCatalog.has(bare)) putCatalog(bare, r.image_url);
      }

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
    const resolved = resolveProductImage({
      name: p.name,
      category: (p as { category?: string | null }).category,
      image_url: p.image_url,
    });
    if (resolved && resolved !== p.image_url) return { ...p, image_url: resolved };
    return p;
  });
}

export function lookupCatalogImage(name?: string | null): string | null {
  if (!name) return null;
  const key = normalizeProductKey(name);
  if (key.length < 2) return null;
  if (globalCatalog.has(key)) return globalCatalog.get(key)!;

  let best: { score: number; url: string } | null = null;
  for (const [k, url] of globalCatalog) {
    if (k === key) return url;
    if (k.includes(key) || key.includes(k)) {
      const score = Math.min(k.length, key.length);
      if (score >= 4 && (!best || score > best.score)) best = { score, url };
    }
  }
  if (best) return best.url;

  const bare = key.replace(/\d+/g, '');
  if (bare.length >= 4 && globalCatalog.has(bare)) return globalCatalog.get(bare)!;
  for (const [k, url] of globalCatalog) {
    const kb = k.replace(/\d+/g, '');
    if (bare.length >= 4 && (kb === bare || kb.includes(bare) || bare.includes(kb))) return url;
  }
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
  const matched = matchDrinkPhoto(opts.name || '', opts.category || '');
  if (matched) return matched;
  const fromCatalog = lookupCatalogImage(opts.name);
  if (fromCatalog) return fromCatalog;
  const cat = (opts.category || '').toLowerCase();
  for (const [k, url] of Object.entries(CATEGORY_URL)) {
    if (cat.includes(k)) return url;
  }
  return VERIFIED.bock50;
}
