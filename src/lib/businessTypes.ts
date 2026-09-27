import type { Role } from './types';

/** Uniquement les 3 types créables / utilisés */
export type BusinessType = 'maquis' | 'location_event' | 'complexe';

export const BUSINESS_TYPES: BusinessType[] = ['maquis', 'location_event', 'complexe'];
export const BUSINESS_TYPES_SELECTABLE: BusinessType[] = BUSINESS_TYPES;

export const BUSINESS_LABELS: Record<BusinessType, string> = {
  maquis: 'Maquis',
  location_event: 'Location événementielle',
  complexe: 'Établissement',
};

export const BUSINESS_DESCRIPTIONS: Record<BusinessType, string> = {
  maquis: 'Boissons, grills et gestion de caisse au quotidien',
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
  inventoryTitle: string;
  inventorySubtitle: string;
  posTitle: string;
  shortcutInventory: string;
  emptyProducts: string;
};

export const BUSINESS_UI: Record<BusinessType, BusinessUI> = {
  maquis: {
    productWord: 'boisson',
    productWordPlural: 'boissons',
    inventoryTitle: 'Inventaire boissons',
    inventorySubtitle: 'Stock, casiers, arrivages',
    posTitle: 'Caisse maquis',
    shortcutInventory: 'Boissons',
    emptyProducts: 'Aucune boisson en stock.',
  },
  location_event: {
    productWord: 'matériel',
    productWordPlural: 'matériels',
    inventoryTitle: 'Parc matériel',
    inventorySubtitle: 'Location et disponibilités',
    posTitle: 'Location',
    shortcutInventory: 'Matériel',
    emptyProducts: 'Aucun matériel enregistré.',
  },
  complexe: {
    productWord: 'article',
    productWordPlural: 'articles',
    inventoryTitle: 'Stock établissement',
    inventorySubtitle: 'Services cochés (bar, resto, chambres…)',
    posTitle: 'Caisse',
    shortcutInventory: 'Stock',
    emptyProducts: 'Aucun produit enregistré.',
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
    '/kitchen': type === 'maquis' ? 'Grill / Bar' : 'Cuisine',
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
  return type === 'maquis';
}

/** Mappe toute ancienne valeur DB vers un des 3 types */
export function normalizeBusinessType(raw: string | null | undefined): BusinessType {
  const v = (raw || '').toLowerCase().trim();
  if (v === 'maquis' || v === 'bar' || v === 'cafe' || v === 'café' || v === 'pharmacie') return 'maquis';
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
    v === 'restaurant' ||
    v === 'resto' ||
    v === 'restauration' ||
    v === 'magasin' ||
    v === 'boutique' ||
    v === 'superette' ||
    v === 'quincaillerie' ||
    v === 'depot' ||
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

export function isDepot(_type: string | null | undefined): boolean {
  return false;
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
