import type { Role } from './types';

/** Types créables : maquis, restaurant, location, établissement */
export type BusinessType = 'maquis' | 'restaurant' | 'location_event' | 'depot' | 'complexe';

export const BUSINESS_TYPES: BusinessType[] = ['maquis', 'restaurant', 'location_event', 'depot', 'complexe'];
export const BUSINESS_TYPES_SELECTABLE: BusinessType[] = BUSINESS_TYPES;

export const BUSINESS_LABELS: Record<BusinessType, string> = {
  maquis: 'Maquis',
  restaurant: 'Restaurant',
  depot: 'Grossiste / Dépôt',
  location_event: 'Location événementielle',
  complexe: 'Établissement',
};

export const BUSINESS_DESCRIPTIONS: Record<BusinessType, string> = {
  maquis: 'Boissons, grills et gestion de caisse au quotidien',
  restaurant: 'Salle, carte, cuisine, réservations et encaissement',
  depot: 'Clients revendeurs, livraisons, tournées, créances et suivi GPS',
  location_event: 'Chaises, tables, bâches, sono — mariages et cérémonies',
  complexe:
    'Un lieu multi-services : maquis, restaurant, chambres, boutique… — vous cochez ce que vous proposez',
};

export const BUSINESS_THEMES: Record<
  BusinessType,
  { primary: string; primarySoft: string; accent: string; label: string; gradient: string }
> = {
  maquis: {
    primary: '#E89B2D',
    primarySoft: 'rgba(232, 155, 45, 0.18)',
    accent: '#C47A12',
    label: 'Crème & Ambre',
    gradient: 'from-amber-500/20 to-orange-600/5',
  },
  restaurant: {
    primary: '#ef4444',
    primarySoft: 'rgba(239, 68, 68, 0.16)',
    accent: '#b91c1c',
    label: 'Rouge resto',
    gradient: 'from-red-500/20 to-rose-700/5',
  },
  depot: {
    primary: '#0ea5e9',
    primarySoft: 'rgba(14, 165, 233, 0.16)',
    accent: '#0369a1',
    label: 'Bleu dépôt',
    gradient: 'from-sky-500/20 to-blue-700/5',
  },
  location_event: {
    primary: '#8b5cf6',
    primarySoft: 'rgba(139, 92, 246, 0.16)',
    accent: '#6d28d9',
    label: 'Violet location',
    gradient: 'from-violet-500/20 to-purple-700/5',
  },
  complexe: {
    primary: '#6d28d9',
    primarySoft: 'rgba(109, 40, 217, 0.16)',
    accent: '#5b21b6',
    label: 'Violet établissement',
    gradient: 'from-violet-600/20 to-indigo-700/5',
  },
};

export const MENU_BY_TYPE: Record<BusinessType, string[]> = {
  maquis: [
    '/dashboard', '/pos', '/live-sales', '/tables', '/print-qr', '/orders', '/kitchen', '/mon-service',
    '/inventory', '/inventory/scan', '/guide', '/menu-qr', '/kits', '/stock-transfer',
    '/purchases', '/suppliers', '/customers', '/point-manuel', '/documents',
    '/expenses', '/mes-employes', '/calendar', '/daily-report', '/cloture', '/patron',
    '/statistics', '/reports', '/accounting', '/ai', '/ai-train', '/chat',
    '/notifications', '/settings',
  ],
  restaurant: [
    '/dashboard', '/tables', '/orders', '/kitchen', '/menu-carte', '/reservations',
    '/pos', '/print-qr', '/menu-qr', '/mon-service',
    '/inventory', '/inventory/scan', '/purchases', '/customers',
    '/expenses', '/mes-employes', '/calendar', '/daily-report', '/cloture',
    '/statistics', '/reports', '/accounting', '/ai', '/chat',
    '/notifications', '/settings', '/guide',
  ],
  depot: [
    '/dashboard', '/depot/clients', '/depot/deliveries', '/depot/tours',
    '/depot/creances', '/depot/tracking', '/depot/consignes', '/depot/prices',
    '/inventory', '/inventory/scan', '/purchases', '/suppliers',
    '/expenses', '/mes-employes', '/daily-report', '/statistics', '/reports', '/accounting',
    '/ai', '/chat', '/notifications', '/settings', '/guide',
  ],
  location_event: [
    '/dashboard', '/rent/equipment', '/rent/clients', '/rent/orders',
    '/rent/movements', '/rent/payments', '/rent/calendar', '/rent/packs',
    '/rent/invoices', '/guide', '/mes-employes', '/daily-report', '/cloture',
    '/ai', '/ai-train', '/chat', '/notifications', '/settings',
  ],
  complexe: [
    '/hotel', '/hotel/rooms', '/hotel/reservations', '/hotel/guests',
    '/hotel/housekeeping', '/hotel/maintenance', '/hotel/events',
    '/hotel/services', '/hotel/settings',
    '/dashboard', '/pos', '/live-sales', '/tables', '/print-qr', '/orders', '/kitchen', '/mon-service',
    '/inventory', '/inventory/scan', '/guide', '/menu-qr', '/purchases', '/customers',
    '/expenses', '/mes-employes', '/calendar', '/daily-report', '/cloture',
    '/statistics', '/reports', '/accounting', '/ai', '/chat',
    '/notifications', '/settings',
  ],
};

/** Services cochés pour un type « Établissement » */
export type EstablishmentServiceId = 'maquis' | 'restaurant' | 'chambres' | 'location' | 'magasin';

const SERVICE_TO_MENU_TYPE: Record<string, BusinessType> = {
  maquis: 'maquis',
  restaurant: 'maquis', // menus F&B proches maquis + routes resto via filtre services
  magasin: 'maquis',
  location: 'location_event',
};

const COMPLEXE_CORE_ROUTES = [
  '/dashboard', '/daily-report', '/expenses', '/mes-employes', '/calendar',
  '/statistics', '/reports', '/accounting', '/ai', '/chat', '/notifications',
  '/settings', '/guide', '/customers', '/purchases', '/inventory', '/inventory/scan', '/pos',
];

const HOTEL_ROUTES = [
  '/hotel', '/hotel/rooms', '/hotel/reservations', '/hotel/guests',
  '/hotel/housekeeping', '/hotel/maintenance', '/hotel/events',
  '/hotel/services', '/hotel/settings',
];

const FNB_ROUTES = [
  '/live-sales', '/tables', '/print-qr', '/orders', '/kitchen', '/mon-service',
  '/menu-qr', '/kits', '/cloture', '/patron', '/point-manuel',
];

const LOCATION_ROUTES = [
  '/rent/equipment', '/rent/clients', '/rent/orders', '/rent/movements',
  '/rent/payments', '/rent/calendar', '/rent/packs', '/rent/invoices',
];

export function getEstablishmentServices(
  establishmentId: string | null | undefined,
  servicesFromRow?: string[] | null,
): string[] {
  if (Array.isArray(servicesFromRow) && servicesFromRow.length) {
    return servicesFromRow.map(String);
  }
  if (!establishmentId) return ['maquis'];
  try {
    const raw = localStorage.getItem(`mm_est_services:${establishmentId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed.map(String);
    }
  } catch { /* */ }
  return ['maquis'];
}

export function menuRoutesForComplexe(services: string[]): string[] {
  const set = new Set<string>(COMPLEXE_CORE_ROUTES);
  const svc = services.length ? services : ['maquis'];
  if (svc.includes('chambres')) HOTEL_ROUTES.forEach((r) => set.add(r));
  if (svc.includes('maquis') || svc.includes('restaurant')) FNB_ROUTES.forEach((r) => set.add(r));
  if (svc.includes('location')) LOCATION_ROUTES.forEach((r) => set.add(r));
  if (svc.includes('magasin')) {
    ['/documents', '/suppliers', '/stock-transfer'].forEach((r) => set.add(r));
  }
  return Array.from(set);
}

export type BusinessUI = {
  productWord: string;
  productWordPlural: string;
  /** Alias legacy pour formulaires inventaire */
  productSingular?: string;
  inventoryTitle: string;
  inventorySubtitle: string;
  posTitle: string;
  shortcutInventory: string;
  emptyProducts: string;
  categories: string[];
  unitDefault: string;
};

export const BUSINESS_UI: Record<BusinessType, BusinessUI> = {
  maquis: {
    productWord: 'boisson',
    productWordPlural: 'boissons',
    productSingular: 'boisson',
    inventoryTitle: 'Inventaire boissons',
    inventorySubtitle: 'Stock, casiers, arrivages, consignes',
    posTitle: 'Caisse maquis',
    shortcutInventory: 'Boissons',
    emptyProducts: 'Aucune boisson en stock.',
    categories: ['Bière', 'Boisson gazeuse', 'Eau', 'Vin', 'Spiritueux', 'Grillade', 'Autre'],
    unitDefault: 'bouteille',
  },
  restaurant: {
    productWord: 'plat',
    productWordPlural: 'plats',
    productSingular: 'plat',
    inventoryTitle: 'Stock cuisine',
    inventorySubtitle: 'Ingrédients et produits liés à la carte',
    posTitle: 'Caisse restaurant',
    shortcutInventory: 'Stock',
    emptyProducts: 'Aucun produit en stock.',
    categories: ['Entrée', 'Plat', 'Dessert', 'Boisson', 'Ingrédient', 'Autre'],
    unitDefault: 'unité',
  },
  depot: {
    productWord: 'référence',
    productWordPlural: 'références',
    productSingular: 'référence',
    inventoryTitle: 'Stock dépôt (gros)',
    inventorySubtitle: 'Cartons, palettes, consignes',
    posTitle: 'Caisse dépôt',
    shortcutInventory: 'Stock gros',
    emptyProducts: 'Aucun produit en stock dépôt.',
    categories: ['Bière', 'Boisson', 'Eau', 'Spiritueux', 'Casier', 'Autre'],
    unitDefault: 'carton',
  },
  location_event: {
    productWord: 'matériel',
    productWordPlural: 'matériels',
    productSingular: 'matériel',
    inventoryTitle: 'Parc matériel',
    inventorySubtitle: 'Location et disponibilités',
    posTitle: 'Location',
    shortcutInventory: 'Matériel',
    emptyProducts: 'Aucun matériel enregistré.',
    categories: ['Chaises', 'Tables', 'Bâches', 'Sono', 'Autre'],
    unitDefault: 'pièce',
  },
  complexe: {
    productWord: 'article',
    productWordPlural: 'articles',
    productSingular: 'article',
    inventoryTitle: 'Stock établissement',
    inventorySubtitle: 'Services cochés (bar, resto, chambres…)',
    posTitle: 'Caisse',
    shortcutInventory: 'Stock',
    emptyProducts: 'Aucun produit enregistré.',
    categories: ['Boisson', 'Alimentaire', 'Chambre', 'Boutique', 'Autre'],
    unitDefault: 'unité',
  },
};

export function getBusinessUI(type: string | null | undefined): BusinessUI {
  return BUSINESS_UI[normalizeBusinessType(type)];
}

export function menuLabelFor(path: string, type: BusinessType): string | null {
  const ui = BUSINESS_UI[type];
  const map: Record<string, string> = {
    '/inventory': ui.inventoryTitle,
    '/pos': ui.posTitle,
    '/inventory/scan': type === 'location_event' ? 'Scan matériel' : 'Scan inventaire',
    '/orders': type === 'location_event' ? 'Commandes location' : 'Commandes',
    '/kitchen': type === 'maquis' ? 'Grill / Bar' : type === 'restaurant' ? 'Cuisine' : 'Cuisine',
    '/tables': type === 'maquis' ? 'Espaces' : 'Tables',
    '/customers': 'Clients',
    '/purchases': 'Achats',
    '/suppliers': 'Fournisseurs',
    '/documents': 'Documents',
    '/live-sales': 'Ventes journée',
  };
  return map[path] ?? null;
}

export function orderWord(type: BusinessType): string {
  if (type === 'location_event') return 'Location';
  if (type === 'complexe') return 'Opération';
  return 'Commande';
}

export function isCommerceType(_type: BusinessType): boolean {
  return false;
}

export function isFnbType(type: BusinessType): boolean {
  return type === 'maquis' || type === 'restaurant';
}

/** Mappe toute ancienne valeur DB vers un des 3 types */
export function normalizeBusinessType(raw: string | null | undefined): BusinessType {
  const v = (raw || '').toLowerCase().trim();
  if (v === 'maquis' || v === 'bar' || v === 'cafe' || v === 'café' || v === 'pharmacie') return 'maquis';
  if (v === 'restaurant' || v === 'resto' || v === 'restauration') return 'restaurant';
  if (v === 'depot' || v === 'grossiste' || v === 'grossiste_depot' || v === 'grossiste_depot_de_boisson') return 'depot';
  if (v === 'location_event' || v === 'location' || v === 'event' || v === 'rental') return 'location_event';
  if (
    v === 'complexe' ||
    v === 'complexe_hotelier' ||
    v === 'etablissement' ||
    v === 'établissement' ||
    v === 'residence' ||
    v === 'résidence' ||
    v === 'hotel' ||
    v === 'hôtel' ||
    v === 'hotelier' ||
    v === 'hotellerie' ||
    v === 'hôtelier' ||
    v === 'magasin' ||
    v === 'boutique' ||
    v === 'superette' ||
    v === 'quincaillerie' ||
    v === 'commerce' ||
    v === 'store' ||
    v === 'shop' ||
    v === 'supermarche' ||
    v === 'btp' ||
    v === 'batidevis' ||
    v === 'construction' ||
    v === 'chantier' ||
    v === 'devis'
  ) {
    return 'complexe';
  }
  if ((BUSINESS_TYPES as string[]).includes(v)) return v as BusinessType;
  return 'maquis';
}

export function isDepot(type: string | null | undefined): boolean {
  return normalizeBusinessType(type) === 'depot';
}

export function isLocationEvent(type: string | null | undefined): boolean {
  return normalizeBusinessType(type) === 'location_event';
}

export function isBtp(_type: string | null | undefined): boolean {
  return false;
}

export function isEtablissementType(type: BusinessType | string | null | undefined): boolean {
  return normalizeBusinessType(type) === 'complexe';
}

export function applyBusinessTheme(type: BusinessType) {
  if (typeof document === 'undefined') return;
  const t = BUSINESS_THEMES[type];
  const root = document.documentElement;
  root.style.setProperty('--biz-primary', t.primary);
  root.style.setProperty('--biz-primary-soft', t.primarySoft);
  root.style.setProperty('--biz-accent', t.accent);
  root.dataset.businessType = type;
}

export function canManageEstablishments(role: Role | undefined): boolean {
  return !!role && ['super_admin', 'admin', 'owner'].includes(role);
}

export function buildWhatsAppLink(phone: string | null | undefined, message: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  let normalized = digits;
  if (digits.startsWith('0') && digits.length >= 10) {
    normalized = '225' + digits.slice(1);
  }
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function buildSmsLink(phone: string | null | undefined, message: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return `sms:${digits}?body=${encodeURIComponent(message)}`;
}


/** Location événementielle — statuts commande */

export function inventoryLabelForServices(services: string[]): string {
  const s = new Set(services || []);
  if (s.has('restaurant') && (s.has('maquis') || s.has('magasin'))) return 'Stock';
  if (s.has('restaurant')) return 'Carte';
  if (s.has('maquis')) return 'Boissons';
  if (s.has('location')) return 'Matériel';
  if (s.has('magasin')) return 'Stock';
  return 'Stock';
}

export const RENTAL_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  quoted: 'Devis',
  confirmed: 'Confirmée',
  out: 'Sortie',
  returned: 'Retournée',
  cancelled: 'Annulée',
  paid: 'Payée',
};

export const EQUIPMENT_CATEGORIES = [
  'chaises',
  'tables',
  'baches',
  'sono',
  'eclairage',
  'decoration',
  'vaisselle',
  'autre',
] as const;

export const EQUIPMENT_CATEGORY_LABELS: Record<string, string> = {
  chaises: 'Chaises',
  tables: 'Tables',
  baches: 'Bâches / Tentes',
  sono: 'Sono',
  eclairage: 'Éclairage',
  decoration: 'Décoration',
  vaisselle: 'Vaisselle',
  autre: 'Autre',
};
