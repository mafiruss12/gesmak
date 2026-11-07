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

/** Pages ouvertes au public (QR, menu) — pas de lien dashboard / login */
function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith('/commander') ||
    pathname.startsWith('/order') ||
    pathname.startsWith('/m/') ||
    pathname.startsWith('/menu') ||
    pathname.startsWith('/public') ||
    pathname.startsWith('/t/')
  );
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    if (isChunkLoadError(error) && typeof window !== 'undefined') {
      const key = 'gesmak_chunk_reload';
      const last = sessionStorage.getItem(key);
      const now = String(Date.now());
      if (!last || Date.now() - Number(last) > 60_000) {
        sessionStorage.setItem(key, now);
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
        : 'Une mise à jour est disponible. Appuyez sur Réessayer pour recharger la page.';
    }
    if (/NetworkError|Failed to fetch|Load failed/i.test(err.message)) {
      return 'Problème de connexion. Vérifiez votre réseau et réessayez.';
    }
    return 'Une erreur temporaire est survenue. Réessayez pour continuer votre commande.';
  }

  render() {
    if (this.state.error) {
      const publicPage =
        typeof window !== 'undefined' && isPublicPath(window.location.pathname);

      return (
        <div className="min-h-[50vh] flex items-center justify-center p-6"
          style={{ background: 'linear-gradient(165deg,#f8fafc 0%,#eef2ff 45%,#fff7ed 100%)' }}>
          <div className="max-w-md text-center space-y-4 error-net-motion">
            <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
              <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 border-r-amber-400 animate-spin" style={{ animationDuration: '2.5s' }} aria-hidden />
              <img src="/logo-circle.png" alt="GESMAK" className="relative z-[1] w-[78%] h-[78%] rounded-full object-cover" />
            </div>
            <h1 className="text-lg font-semibold text-stone-800">
              Impossible d&apos;ouvrir cette page
            </h1>
            <p className="text-sm text-stone-600 leading-relaxed">
              {this.friendlyMessage()}
            </p>
            <style>{`
              .error-net-motion { animation: errNetIn .45s ease both; }
              @keyframes errNetIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `}</style>
            <div className="flex flex-col gap-2 justify-center">
              <button
                type="button"
                className="btn-primary min-h-[48px]"
                onClick={() => {
                  this.setState({ error: null });
                  window.location.reload();
                }}
              >
                Réessayer
              </button>
              {/* Jamais de lien dashboard / login pour le public (commande QR) */}
              {!publicPage && (
                <button
                  type="button"
                  className="btn-secondary min-h-[44px]"
                  onClick={() => {
                    this.setState({ error: null });
                    window.location.assign('/');
                  }}
                >
                  Page de connexion
                </button>
              )}
              {publicPage && (
                <p className="text-xs text-stone-500">
                  Si le problème continue, rescannez le QR de la table ou demandez au serveur.
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
