/** QR propre à chaque établissement — URL + apparence */

export type QrConfig = {
  /** Couleur du QR (hex sans # ou avec) */
  color?: string;
  /** Fond du QR */
  bg?: string;
  /** Titre affiché sous/sur le QR */
  title?: string;
  /** Message d’accueil client */
  welcome?: string;
  /** Afficher le nom de l’établissement sur la page commande */
  show_name?: boolean;
  /** Mode kiosque par défaut sur QR table */
  kiosk_default?: boolean;
};

export const DEFAULT_QR_CONFIG: Required<QrConfig> = {
  color: '1c1917',
  bg: 'ffffff',
  title: '',
  welcome: 'Bienvenue — passez votre commande',
  show_name: true,
  kiosk_default: true,
};

export function parseQrConfig(raw: unknown): Required<QrConfig> {
  const o = (raw && typeof raw === 'object' ? raw : {}) as QrConfig;
  return {
    color: String(o.color || DEFAULT_QR_CONFIG.color).replace('#', ''),
    bg: String(o.bg || DEFAULT_QR_CONFIG.bg).replace('#', ''),
    title: String(o.title || ''),
    welcome: String(o.welcome || DEFAULT_QR_CONFIG.welcome),
    show_name: o.show_name !== false,
    kiosk_default: o.kiosk_default !== false,
  };
}

/** Identifiant public stable : slug si dispo, sinon id */
export function publicEstKey(est: { id: string; slug?: string | null }) {
  const s = (est.slug || '').trim();
  return s || est.id;
}

export function orderUrl(opts: {
  origin: string;
  estKey: string;
  table?: string | number;
  kiosk?: boolean;
}) {
  const base = `${opts.origin}/commander/${encodeURIComponent(opts.estKey)}`;
  const q = new URLSearchParams();
  if (opts.table != null && String(opts.table) !== '') q.set('table', String(opts.table));
  if (opts.kiosk) q.set('kiosk', '1');
  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
}

export function menuPublicUrl(origin: string, estKey: string) {
  return `${origin}/m/${encodeURIComponent(estKey)}`;
}

export function profilePublicUrl(origin: string, slug: string) {
  return `${origin}/e/${encodeURIComponent(slug)}`;
}

/** Image QR via api.qrserver (couleur + fond personnalisables) */
export function qrImageUrl(data: string, cfg: QrConfig, size = 280) {
  const c = parseQrConfig(cfg);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=12&color=${encodeURIComponent(c.color)}&bgcolor=${encodeURIComponent(c.bg)}&data=${encodeURIComponent(data)}`;
}
