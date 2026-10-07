/** Version affichée dans l'app (incrémenter à chaque release notable) */
export const APP_VERSION = '1.2.3';
export const APP_VERSION_CODE = 8;

export const GITHUB_OWNER = 'mafiruss12';
export const GITHUB_REPO = 'maquis-manager-ai-a-jour';
export const GITHUB_RELEASES_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
export const GITHUB_RELEASES_PAGE = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;
export const WEB_APP_URL = 'https://stock-manager-ai.pages.dev';
export const VERSION_JSON_URL = `${WEB_APP_URL}/version.json`;

export function parseVersion(v: string): number[] {
  return v.replace(/^v/i, '').split(/[.+-]/).map((x) => parseInt(x, 10) || 0);
}

/** true si remote > local */
export function isNewerVersion(remote: string, local: string = APP_VERSION): boolean {
  const a = parseVersion(remote);
  const b = parseVersion(local);
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

export interface LatestRelease {
  tag: string;
  name: string;
  body: string;
  apkUrl: string | null;
  htmlUrl: string;
}

export async function fetchLatestRelease(): Promise<LatestRelease | null> {
  try {
    const res = await fetch(GITHUB_RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const assets = (data.assets || []) as { name: string; browser_download_url: string }[];
    const apk =
      assets.find((a) => a.name.toLowerCase().endsWith('.apk')) ||
      assets.find((a) => a.name.toLowerCase().includes('maquis'));
    return {
      tag: (data.tag_name || '').replace(/^v/i, ''),
      name: data.name || data.tag_name || '',
      body: data.body || '',
      apkUrl: apk?.browser_download_url ?? null,
      htmlUrl: data.html_url || GITHUB_RELEASES_PAGE,
    };
  } catch {
    return null;
  }
}

export async function fetchRemoteWebVersion(): Promise<{ version: string; notes?: string } | null> {
  try {
    const res = await fetch(VERSION_JSON_URL + '?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return { version: String(data.version || ''), notes: data.notes };
  } catch {
    return null;
  }
}

/**
 * Force la mise à jour du contenu web (PWA + WebView Capacitor).
 * - Désinscrit le Service Worker
 * - Vide les caches
 * - Recharge sans cache
 * Sur APK purement locale, le JS embarqué ne change qu'avec une nouvelle APK ;
 * on recharge quand même pour rafraîchir session / données.
 */
export async function forceAppUpdate(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    /* */
  }
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* */
  }

  // Capacitor WebView : essayer de recharger depuis le site live si possible
  try {
    const Cap = (window as any).Capacitor;
    if (Cap?.isNativePlatform?.()) {
      // Recharge l'URL actuelle (assets locaux ou serveur)
      window.location.href = WEB_APP_URL + '/?_v=' + Date.now();
      return;
    }
  } catch {
    /* */
  }

  const url = new URL(window.location.href);
  url.searchParams.set('_v', String(Date.now()));
  window.location.replace(url.toString());
}
