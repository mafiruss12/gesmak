/** Thèmes nappe QR — défauts + personnalisation établissement */

export type PlacematTheme = {
  id: string;
  label: string;
  desc?: string;
  navy: string;
  gold: string;
  cream: string;
  ink: string;
  dark: boolean;
  foodLeft: string;
  foodRight: string;
};

export type PlacematSettings = {
  activeThemeId: string;
  slogan: string;
  footerLine: string;
  scanLabel: string;
  brandLine: string;
  showFood: boolean;
  showIcons: boolean;
  showChef: boolean;
  /** Thèmes créés / modifiés par le propriétaire */
  customThemes: PlacematTheme[];
};

export const IMG = {
  wings:
    'https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=600&q=80',
  skewers:
    'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80',
  juice:
    'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?auto=format&fit=crop&w=400&q=80',
  cocktail:
    'https://images.unsplash.com/photo-1514362545857-3bc16549766b?auto=format&fit=crop&w=400&q=80',
  beer:
    'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=400&q=80',
  grill:
    'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
};

export const DEFAULT_THEMES: PlacematTheme[] = [
  {
    id: 'maquis_photo',
    label: 'Maquis photo (pro)',
    desc: 'Fond noir · grillades · boissons',
    navy: '#050505',
    gold: '#f5c518',
    cream: '#0a0a0a',
    ink: '#ffffff',
    dark: true,
    foodLeft: IMG.wings,
    foodRight: IMG.skewers,
  },
  {
    id: 'marine_or',
    label: 'Marine & or',
    desc: 'Bleu nuit',
    navy: '#061428',
    gold: '#f5c518',
    cream: '#061428',
    ink: '#ffffff',
    dark: true,
    foodLeft: IMG.grill,
    foodRight: IMG.cocktail,
  },
  {
    id: 'orange_noir',
    label: 'Orange & noir',
    desc: 'GESMAK',
    navy: '#1a0800',
    gold: '#FF7900',
    cream: '#120500',
    ink: '#ffffff',
    dark: true,
    foodLeft: IMG.beer,
    foodRight: IMG.grill,
  },
  {
    id: 'noir_or',
    label: 'Noir & or classic',
    navy: '#000000',
    gold: '#eab308',
    cream: '#0c0c0c',
    ink: '#fafafa',
    dark: true,
    foodLeft: IMG.juice,
    foodRight: IMG.skewers,
  },
  {
    id: 'clair',
    label: 'Clair premium',
    navy: '#1c1917',
    gold: '#b45309',
    cream: '#fffbeb',
    ink: '#1c1917',
    dark: false,
    foodLeft: IMG.wings,
    foodRight: IMG.juice,
  },
];

export const DEFAULT_PLACEMAT: PlacematSettings = {
  activeThemeId: 'maquis_photo',
  slogan: 'Bon repas, bonne ambiance !',
  footerLine: 'Votre satisfaction, notre priorité !',
  scanLabel: 'Scannez ici',
  brandLine: '',
  showFood: true,
  showIcons: true,
  showChef: true,
  customThemes: [],
};

export function parsePlacemat(raw: unknown): PlacematSettings {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const p = (o.placemat && typeof o.placemat === 'object' ? o.placemat : o) as Record<string, unknown>;
  const customs = Array.isArray(p.customThemes)
    ? (p.customThemes as PlacematTheme[]).filter((t) => t && t.id && t.label)
    : [];
  return {
    activeThemeId: String(p.activeThemeId || DEFAULT_PLACEMAT.activeThemeId),
    slogan: String(p.slogan ?? DEFAULT_PLACEMAT.slogan),
    footerLine: String(p.footerLine ?? DEFAULT_PLACEMAT.footerLine),
    scanLabel: String(p.scanLabel ?? DEFAULT_PLACEMAT.scanLabel),
    brandLine: String(p.brandLine ?? ''),
    showFood: p.showFood !== false,
    showIcons: p.showIcons !== false,
    showChef: p.showChef !== false,
    customThemes: customs,
  };
}

export function allThemes(settings: PlacematSettings): PlacematTheme[] {
  const map = new Map<string, PlacematTheme>();
  for (const t of DEFAULT_THEMES) map.set(t.id, t);
  for (const t of settings.customThemes) map.set(t.id, t);
  return Array.from(map.values());
}

export function resolveTheme(settings: PlacematSettings): PlacematTheme {
  const list = allThemes(settings);
  return list.find((t) => t.id === settings.activeThemeId) || list[0];
}

export function newThemeId() {
  return `custom_${Date.now().toString(36)}`;
}
