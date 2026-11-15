import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/** Relance l'import dynamique une fois (déploiement / cache SW). */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
  retries = 1
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isChunk =
        /Failed to fetch dynamically imported module|Loading chunk|Importing a module script failed/i.test(
          msg
        );
      if (isChunk && retries > 0) {
        // Court délai puis retry (réseau flaky)
        await new Promise((r) => setTimeout(r, 400));
        return factory();
      }
      if (isChunk && typeof window !== 'undefined') {
        const key = 'gesmak_lazy_reload';
        const last = sessionStorage.getItem(key);
        if (!last || Date.now() - Number(last) > 45_000) {
          sessionStorage.setItem(key, String(Date.now()));
          try {
            if ('caches' in window) {
              const keys = await caches.keys();
              await Promise.all(keys.map((k) => caches.delete(k)));
            }
          } catch {
            /* ignore */
          }
          window.location.reload();
        }
      }
      throw err;
    }
  });
}
