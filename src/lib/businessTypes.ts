import type { Role } from './types';

export type BusinessType =
  | 'maquis'
  | 'restaurant'
  | 'magasin'
  | 'boutique'
  | 'superette'
  | 'quincaillerie'
  | 'location_event'
  | 'btp'
  | 'depot'
  | 'complexe';


export const BUSINESS_TYPES: BusinessType[] = [
  'maquis',
  'restaurant',
  'magasin',
  'boutique',
  'superette',
  'quincaillerie',
  'location_event',
  'btp',
  'depot',
  'complexe',
];


export const BUSINESS_LABELS: Record<BusinessType, string> = {
  maquis: 'Maquis',
  restaurant: 'Restaurant',
  magasin: 'Magasin',
  boutique: 'Boutique',
  superette: 'Supérette',
  quincaillerie: 'Quincaillerie',
  location_event: 'Location événementielle',
  btp: 'BTP / BatiDevis',
  depot: 'Dépôt / Grossiste',
  complexe: 'Établissement',
};

export const BUSINESS_DESCRIPTIONS: Record<BusinessType, string> = {
  maquis: 'Boissons, grills et gestion de caisse au quotidien',
  restaurant: 'Salle, commandes cuisine, carte et caisse',
  magasin: 'Stock produits, achats, marge et vente au détail',
  boutique: 'Articles, collections et vente au détail',
  superette: 'Épicerie, stock rapide et rayons',
  quincaillerie: 'Matériaux, outillage et stock technique',
  location_event: 'Chaises, tables, bâches, sono — mariages et cérémonies',
  btp: 'Devis, factures et matériaux pour artisans et entreprises du bâtiment',
  depot: 'Livraisons boissons aux maquis, bars et restaurants — stock gros et bons de livraison',
  complexe: 'Un lieu avec plusieurs services (maquis, restaurant, chambres…) — vous cochez ce que vous proposez',
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
    gradient: 'from-red-500/20 to-orange-600/5',
  },
  magasin: {
    primary: '#06b6d4',
    primarySoft: 'rgba(6, 182, 212, 0.15)',
    accent: '#0891b2',
    label: 'Cyan',
    gradient: 'from-cyan-500/20 to-blue-600/5',
  },
  boutique: {
    primary: '#ec4899',
    primarySoft: 'rgba(236, 72, 153, 0.15)',
    accent: '#db2777',
    label: 'Rose',
    gradient: 'from-pink-500/20 to-rose-600/5',
  },
  superette: {
    primary: '#84cc16',
    primarySoft: 'rgba(132, 204, 22, 0.15)',
    accent: '#65a30d',
    label: 'Lime',
    gradient: 'from-lime-500/20 to-green-600/5',
  },
  quincaillerie: {
    primary: '#f97316',
    primarySoft: 'rgba(249, 115, 22, 0.15)',
    accent: '#ea580c',
    label: 'Orange',
    gradient: 'from-orange-500/20 to-amber-600/5',
  },
  location_event: {
    primary: '#6366f1',
    primarySoft: 'rgba(99, 102, 241, 0.15)',
    accent: '#4f46e5',
    label: 'Indigo',
    gradient: 'from-indigo-500/20 to-violet-600/5',
  },
  btp: {
    primary: '#0ea5e9',
    primarySoft: 'rgba(14, 165, 233, 0.15)',
    accent: '#0284c7',
    label: 'Sky',
    gradient: 'from-sky-500/20 to-blue-600/5',
  },
  depot: {
    primary: '#0d9488',
    primarySoft: 'rgba(13, 148, 136, 0.16)',
    accent: '#0f766e',
    label: 'Teal',
    gradient: 'from-teal-500/20 to-cyan-600/5',
  },
  complexe: {
    primary: '#7c3aed',
    primarySoft: 'rgba(124, 58, 237, 0.16)',
    accent: '#5b21b6',
    label: 'Violet',
    gradient: 'from-violet-500/20 to-purple-700/5',
  },
};

export const MENU_BY_TYPE: Record<BusinessType, string[]> = {
  maquis: [
    '/dashboard', '/pos', '/live-sales', '/tables', '/print-qr', '/orders', '/kitchen', '/mon-service', '/inventory', '/inventory/scan', '/guide',
    '/menu-qr', '/purchases', '/customers',
    '/expenses', '/mes-employes', '/calendar', '/daily-report',
    '/statistics', '/reports', '/accounting', '/ai', '/chat',
    '/notifications', '/settings',
  ],
  restaurant: [
    '/dashboard', '/pos', '/documents', '/inventory', '/inventory/scan', '/point-manuel', '/guide',
    '/kits', '/menu-qr', '/stock-transfer', '/orders', '/tables', '/print-qr', '/kitchen', '/mon-service', '/purchases', '/suppliers', '/customers',
    '/expenses', '/mes-employes', '/calendar', '/daily-report', '/cloture', '/patron',
    '/statistics', '/reports', '/accounting', '/ai', '/ai-train', '/chat',
    '/notifications', '/settings',
  ],
  magasin: [
    '/dashboard', '/pos', '/documents', '/inventory', '/inventory/scan', '/point-manuel', '/guide',
    '/kits', '/menu-qr', '/stock-transfer', '/purchases', '/suppliers', '/customers',
    '/expenses', '/mes-employes', '/daily-report', '/cloture', '/statistics', '/accounting', '/reports',
    '/ai', '/ai-train', '/chat', '/notifications', '/settings',
  ],
  boutique: [
    '/dashboard', '/pos', '/documents', '/inventory', '/inventory/scan', '/point-manuel', '/guide',
    '/kits', '/menu-qr', '/stock-transfer', '/purchases', '/suppliers', '/customers',
    '/expenses', '/mes-employes', '/daily-report', '/cloture', '/statistics', '/accounting', '/reports',
    '/ai', '/ai-train', '/chat', '/notifications', '/settings',
  ],
  superette: [
    '/dashboard', '/pos', '/documents', '/inventory', '/inventory/scan', '/point-manuel', '/guide',
    '/kits', '/menu-qr', '/stock-transfer', '/purchases', '/suppliers', '/customers',
    '/expenses', '/mes-employes', '/daily-report', '/cloture', '/statistics', '/accounting', '/reports',
    '/ai', '/ai-train', '/chat', '/notifications', '/settings',
  ],
  quincaillerie: [
    '/dashboard', '/pos', '/documents', '/inventory', '/inventory/scan', '/point-manuel', '/guide',
    '/kits', '/menu-qr', '/stock-transfer', '/purchases', '/suppliers', '/customers',
    '/expenses', '/mes-employes', '/daily-report', '/cloture', '/statistics', '/accounting', '/reports',
    '/ai', '/ai-train', '/chat', '/notifications', '/settings',
  ],
  location_event: [
    '/dashboard', '/rent/equipment', '/rent/clients', '/rent/orders',
    '/rent/movements', '/rent/payments', '/rent/calendar', '/rent/packs',
    '/rent/invoices', '/guide', '/mes-employes', '/daily-report', '/cloture',
    '/ai', '/ai-train', '/chat', '/notifications', '/settings',
  ],
  btp: [
    '/dashboard', '/btp/documents', '/btp/clients', '/btp/materials',
    '/guide', '/mes-employes', '/expenses', '/statistics',
    '/ai', '/ai-train', '/chat', '/notifications', '/settings',
  ],
  depot: [
    '/dashboard', '/depot/clients', '/depot/deliveries', '/inventory', '/inventory/scan',
    '/customers', '/expenses', '/accounting', '/statistics', '/daily-report',
    '/guide', '/mes-employes', '/ai', '/chat', '/notifications', '/settings',
  ],
  complexe: [
    '/dashboard', '/pos', '/live-sales', '/tables', '/print-qr', '/orders', '/kitchen', '/mon-service',
    '/inventory', '/inventory/scan', '/guide', '/menu-qr', '/purchases', '/customers',
    '/expenses', '/mes-employes', '/calendar', '/daily-report', '/cloture',
    '/statistics', '/reports', '/accounting', '/ai', '/chat',
    '/notifications', '/settings',
  ],
};


/** Services cochés pour un type « Établissement » (complexe) */
export type EstablishmentServiceId = 'maquis' | 'restaurant' | 'chambres' | 'location' | 'magasin';

const SERVICE_TO_MENU_TYPE: Record<string, BusinessType> = {
  maquis: 'maquis',
  restaurant: 'restaurant',
  magasin: 'magasin',
  location: 'location_event',
  // chambres : tronc commun (pas encore de module dédié)
};

/** Routes de base toujours présentes pour un établissement multi-services */
const COMPLEXE_CORE_ROUTES = [
  '/dashboard',
  '/daily-report',
  '/expenses',
  '/mes-employes',
  '/calendar',
  '/statistics',
  '/reports',
  '/accounting',
  '/ai',
  '/chat',
  '/notifications',
  '/settings',
  '/guide',
  '/customers',
  '/purchases',
  '/inventory',
  '/inventory/scan',
  '/pos',
];

/**
 * Lit les services cochés (localStorage prioritaire, puis champ establishment.services).
 */
export function getEstablishmentServices(
  establishmentId: string | null | undefined,
  fromDb?: string[] | null,
): EstablishmentServiceId[] {
  const fallback: EstablishmentServiceId[] = ['maquis'];
  if (!establishmentId) return fallback;
  try {
    const raw = localStorage.getItem(`mm_est_services:${establishmentId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as EstablishmentServiceId[];
    }
  } catch { /* */ }
  if (Array.isArray(fromDb) && fromDb.length > 0) {
    return fromDb as EstablishmentServiceId[];
  }
  return fallback;
}

/**
 * Construit les routes autorisées pour le type établissement selon les services cochés.
 * Union des menus métier + routes cœur — évite un menu 100 % maquis.
 */
export function menuRoutesForComplexe(services: string[]): string[] {
  const set = new Set<string>(COMPLEXE_CORE_ROUTES);
  const list = services?.length ? services : ['maquis'];
  for (const s of list) {
    if (s === 'chambres') {
      set.add('/calendar');
      set.add('/customers');
      set.add('/expenses');
      set.add('/inventory');
      continue;
    }
    const mapped = SERVICE_TO_MENU_TYPE[s];
    if (mapped && MENU_BY_TYPE[mapped]) {
      for (const r of MENU_BY_TYPE[mapped]) set.add(r);
    }
  }
  return Array.from(set);
}

/** Libellés adaptatifs selon services (bas de page / inventaire) */
export function inventoryLabelForServices(services: string[]): string {
  const s = new Set(services || []);
  if (s.has('restaurant') && (s.has('maquis') || s.has('magasin'))) return 'Stock';
  if (s.has('restaurant')) return 'Carte';
  if (s.has('maquis')) return 'Boissons';
  if (s.has('location')) return 'Matériel';
  if (s.has('magasin')) return 'Stock';
  return 'Stock';
}

export const EQUIPMENT_CATEGORIES = [
  'chaises', 'chaises_presidentielles', 'tables', 'treteaux', 'baches',
  'chapiteaux', 'sonorisation', 'vaisselle', 'decoration', 'autres',
] as const;

export const EQUIPMENT_CATEGORY_LABELS: Record<string, string> = {
  chaises: 'Chaises',
  chaises_presidentielles: 'Chaises présidentielles',
  tables: 'Tables',
  treteaux: 'Tréteaux',
  baches: 'Bâches',
  chapiteaux: 'Chapiteaux',
  sonorisation: 'Sonorisation',
  vaisselle: 'Vaisselle',
  decoration: 'Décoration',
  autres: 'Autres',
};

export const RENTAL_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  confirmed: 'Confirmée',
  out: 'En sortie',
  returned: 'Retournée',
  cancelled: 'Annulée',
};


/** Libellés métier cohérents par type d'établissement */
export interface BusinessUI {
  productSingular: string;
  productPlural: string;
  inventoryTitle: string;
  inventorySubtitle: string;
  posTitle: string;
  posSubtitle: string;
  stockAlert: string;
  categories: string[];
  unitDefault: string;
  salesLabel: string;
  shortcutInventory: string;
  emptyProducts: string;
}

export const BUSINESS_UI: Record<BusinessType, BusinessUI> = {
  maquis: {
    productSingular: 'Boisson / article',
    productPlural: 'Boissons & grillades',
    inventoryTitle: 'Inventaire maquis',
    inventorySubtitle: 'Boissons, casiers et grillades',
    posTitle: 'Caisse maquis',
    posSubtitle: 'Vente rapide au comptoir',
    stockAlert: 'Boissons en rupture',
    categories: ['Bière', 'Soda', 'Eau', 'Vin', 'Spiritueux', 'Énergie', 'Grillade', 'Accompagnement', 'Autre'],
    unitDefault: 'bouteille',
    salesLabel: 'Ventes',
    shortcutInventory: 'Boissons',
    emptyProducts: 'Aucune boisson en stock. Importez un catalogue ou ajoutez des produits.',
  },
  restaurant: {
    productSingular: 'Plat / boisson',
    productPlural: 'Carte & boissons',
    inventoryTitle: 'Inventaire restaurant',
    inventorySubtitle: 'Plats, accompagnements et boissons',
    posTitle: 'Caisse restaurant',
    posSubtitle: 'Encaissement table / comptoir',
    stockAlert: 'Rupture cuisine ou bar',
    categories: ['Entrée', 'Plat', 'Grillade', 'Accompagnement', 'Dessert', 'Bière', 'Soda', 'Eau', 'Vin', 'Autre'],
    unitDefault: 'portion',
    salesLabel: 'Ventes',
    shortcutInventory: 'Carte',
    emptyProducts: 'Aucun plat ni boisson. Importez la carte ou ajoutez des produits.',
  },
  magasin: {
    productSingular: 'Produit',
    productPlural: 'Produits',
    inventoryTitle: 'Inventaire magasin',
    inventorySubtitle: 'Références, quantités et seuils',
    posTitle: 'Caisse magasin',
    posSubtitle: 'Vente au détail',
    stockAlert: 'Produits sous seuil',
    categories: ['Alimentaire', 'Hygiène', 'Électronique', 'Divers', 'Autre'],
    unitDefault: 'pièce',
    salesLabel: 'Ventes',
    shortcutInventory: 'Stock',
    emptyProducts: 'Aucun produit. Ajoutez vos références magasin.',
  },
  boutique: {
    productSingular: 'Article',
    productPlural: 'Articles',
    inventoryTitle: 'Stock boutique',
    inventorySubtitle: 'Collections et tailles',
    posTitle: 'Caisse boutique',
    posSubtitle: 'Vente d’articles',
    stockAlert: 'Articles en rupture',
    categories: ['Homme', 'Femme', 'Enfant', 'Accessoire', 'Autre'],
    unitDefault: 'pièce',
    salesLabel: 'Ventes',
    shortcutInventory: 'Articles',
    emptyProducts: 'Aucun article boutique.',
  },
  superette: {
    productSingular: 'Produit',
    productPlural: 'Rayons',
    inventoryTitle: 'Inventaire supérette',
    inventorySubtitle: 'Rayons et réassort',
    posTitle: 'Caisse supérette',
    posSubtitle: 'Encaissement rapide',
    stockAlert: 'Rayons à réapprovisionner',
    categories: ['Épicerie', 'Frais', 'Boissons', 'Hygiène', 'Autre'],
    unitDefault: 'pièce',
    salesLabel: 'Ventes',
    shortcutInventory: 'Rayons',
    emptyProducts: 'Aucun produit en rayon.',
  },
  quincaillerie: {
    productSingular: 'Article',
    productPlural: 'Matériaux & outillage',
    inventoryTitle: 'Stock quincaillerie',
    inventorySubtitle: 'Matériaux, outils et consommables',
    posTitle: 'Caisse quincaillerie',
    posSubtitle: 'Vente matériaux et outils',
    stockAlert: 'Articles techniques bas',
    categories: ['Outillage', 'Quincaillerie', 'Électricité', 'Plomberie', 'Peinture', 'Autre'],
    unitDefault: 'pièce',
    salesLabel: 'Ventes',
    shortcutInventory: 'Matériaux',
    emptyProducts: 'Aucun article quincaillerie.',
  },
  location_event: {
    productSingular: 'Matériel',
    productPlural: 'Matériel de location',
    inventoryTitle: 'Parc matériel',
    inventorySubtitle: 'Chaises, tables, sono…',
    posTitle: 'Caisse location',
    posSubtitle: 'Encaissement location',
    stockAlert: 'Matériel indisponible',
    categories: ['Chaises', 'Tables', 'Chapiteaux', 'Sono', 'Décoration', 'Autre'],
    unitDefault: 'unité',
    salesLabel: 'Locations',
    shortcutInventory: 'Matériel',
    emptyProducts: 'Aucun matériel. Ajoutez le parc location.',
  },
  btp: {
    productSingular: 'Matériau',
    productPlural: 'Matériaux BTP',
    inventoryTitle: 'Catalogue matériaux',
    inventorySubtitle: 'Prix unitaires et catégories chantier',
    posTitle: 'Devis & factures',
    posSubtitle: 'Documents BTP',
    reportTitle: 'Suivi chantier',
    emptyProducts: 'Aucun matériau. Ajoutez ciment, fer, main-d\'œuvre…',
  },
  depot: {
    productSingular: 'Boisson (gros)',
    productPlural: 'Catalogue dépôt',
    inventoryTitle: 'Stock dépôt',
    inventorySubtitle: 'Casiers, cartons et lots en gros',
    posTitle: 'Livraisons',
    posSubtitle: 'Bons de livraison maquis / bars',
    stockAlert: 'Rupture stock dépôt',
    categories: ['Bière', 'Soda', 'Eau', 'Énergie', 'Vin', 'Spiritueux', 'Alcool', 'Autre'],
    unitDefault: 'bouteille',
    salesLabel: 'Livraisons',
    shortcutInventory: 'Stock dépôt',
    emptyProducts: 'Aucun produit en stock dépôt. Ajoutez le catalogue gros.',
  },
  complexe: {
    productSingular: 'Article / service',
    productPlural: 'Services & stock',
    inventoryTitle: 'Inventaire établissement',
    inventorySubtitle: 'Boissons, restauration et fournitures multi-services',
    posTitle: 'Caisse établissement',
    posSubtitle: 'Encaissement selon vos services',
    stockAlert: 'Ruptures multi-services',
    categories: ['Chambre', 'Bière', 'Soda', 'Eau', 'Plat', 'Grillade', 'Service', 'Autre'],
    unitDefault: 'unité',
    salesLabel: 'Ventes',
    shortcutInventory: 'Stock',
    emptyProducts: 'Aucun article. Ajoutez le stock des services (bar, resto, etc.).',
  },
};

export function getBusinessUI(type: string | null | undefined): BusinessUI {
  return BUSINESS_UI[normalizeBusinessType(type)];
}

/** Libellés de menu adaptés au métier */
export function menuLabelFor(path: string, type: BusinessType): string | null {
  const ui = BUSINESS_UI[type];
  const map: Record<string, string> = {
    '/inventory': ui.inventoryTitle,
    '/pos': ui.posTitle,
    '/inventory/scan': type === 'location_event' ? 'Scan matériel' : 'Scan inventaire',
    '/orders': type === 'location_event' ? 'Commandes location' : 'Commandes',
    '/kitchen': 'Préparation',
    '/tables': 'Espaces',
    '/customers': type === 'location_event' ? 'Clients location' : 'Clients',
  };
  return map[path] ?? null;
}


export function normalizeBusinessType(raw: string | null | undefined): BusinessType {
  const v = (raw || '').toLowerCase().trim();
  // Anciens types retirés → maquis
  if (v in { bar: 1, pharmacie: 1, commerce: 1, cafe: 1 }) return 'maquis';
  if (v === 'resto' || v === 'restauration') return 'restaurant';
  const allowed: BusinessType[] = [
    'maquis', 'restaurant', 'magasin', 'boutique', 'superette', 'quincaillerie', 'location_event', 'btp', 'depot', 'complexe',
  ];
  if ((allowed as string[]).includes(v)) return v as BusinessType;
  if (v === 'store' || v === 'shop') return 'magasin';
  if (v === 'superette' || v === 'supermarche') return 'superette';
  if (v === 'location' || v === 'event' || v === 'rental') return 'location_event';
  if (v === 'batidevis' || v === 'construction' || v === 'chantier' || v === 'devis') return 'btp';
  if (v === 'depot' || v === 'grossiste' || v === 'gros' || v === 'wholesaler' || v === 'entrepot' || v === 'entrepôt') return 'depot';
  if (v === 'complexe' || v === 'residence' || v === 'résidence' || v === 'hotel' || v === 'hôtel' || v === 'hotellerie' || v === 'hôtelier') return 'complexe';
  return 'maquis';
}

export function isDepot(type: string | null | undefined): boolean {
  return normalizeBusinessType(type) === 'depot';
}


export function isLocationEvent(type: string | null | undefined): boolean {
  return normalizeBusinessType(type) === 'location_event';
}

export function isBtp(type: string | null | undefined): boolean {
  return normalizeBusinessType(type) === 'btp';
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
