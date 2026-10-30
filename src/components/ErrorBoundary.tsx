import { Component, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

function isChunkLoadError(err: Error | null): boolean {
  if (!err) return false;
  const m = (err.message || '') + (err.name || '');
  return (
    /Failed to fetch dynamically imported module/i.test(m) ||
    /Loading chunk [\d]+ failed/i.test(m) ||
    /ChunkLoadError/i.test(m) ||
    /Importing a module script failed/i.test(m)
  );
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Une seule auto-recharge après un déploiement (chunks hash changés)
    if (isChunkLoadError(error) && typeof window !== 'undefined') {
      const key = 'gesmak_chunk_reload';
      const last = sessionStorage.getItem(key);
      const now = String(Date.now());
      if (!last || Date.now() - Number(last) > 60_000) {
        sessionStorage.setItem(key, now);
        // Purge SW + caches puis reload
        void (async () => {
          try {
            if ('serviceWorker' in navigator) {
              const regs = await navigator.serviceWorker.getRegistrations();
              await Promise.all(regs.map((r) => r.unregister()));
            }
            if ('caches' in window) {
              const keys = await caches.keys();
              await Promise.all(keys.map((k) => caches.delete(k)));
            }
          } catch {
            /* ignore */
          }
          const url = new URL(window.location.href);
          url.searchParams.set('_r', String(Date.now()));
          window.location.replace(url.toString());
        })();
      }
    }
  }

  private friendlyMessage(): string {
    const err = this.state.error;
    if (!err) return '';
    if (isChunkLoadError(err)) {
      return !navigator.onLine
        ? 'Connexion internet requise pour ouvrir cette page. Réactivez le réseau puis appuyez sur Réessayer.'
        : 'Une mise à jour de l’application est disponible. Appuyez sur Réessayer pour charger la dernière version.';
    }
    if (/NetworkError|Failed to fetch|Load failed/i.test(err.message)) {
      return 'Problème de connexion. Vérifiez votre réseau et réessayez.';
    }
    return 'Une erreur temporaire est survenue. Vous pouvez réessayer sans perdre votre session.';
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-[50vh] bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex items-center justify-center p-6">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-lg font-semibold text-stone-800 dark:text-stone-100">
              Impossible d&apos;ouvrir cette page
            </h1>
            <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
              {this.friendlyMessage()}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  this.setState({ error: null });
                  window.location.reload();
                }}
              >
                Réessayer
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  this.setState({ error: null });
                  window.location.assign('/dashboard');
                }}
              >
                Accueil
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
