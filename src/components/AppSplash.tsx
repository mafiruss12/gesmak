import { useEffect, useState } from 'react';

const MIN_MS = 2200;
const SESSION_KEY = 'gesmak_splash_v1';

/**
 * Écran d’accueil : logo GESMAK + barre qui se remplit, puis l’app.
 * Une fois par onglet (sessionStorage). Toujours au cold start.
 */
export function useAppSplash() {
  const [ready, setReady] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Retirer le splash HTML statique dès que React est monté
    const boot = document.getElementById('gesmak-boot-splash');
    if (boot) {
      boot.style.transition = 'opacity .35s ease';
      boot.style.opacity = '0';
      window.setTimeout(() => boot.remove(), 400);
    }

    if (ready) return;

    const t0 = Date.now();
    const tick = window.setInterval(() => {
      const p = Math.min(100, ((Date.now() - t0) / MIN_MS) * 100);
      setProgress(p);
    }, 40);

    const done = window.setTimeout(() => {
      try {
        sessionStorage.setItem(SESSION_KEY, '1');
      } catch { /* */ }
      setProgress(100);
      setReady(true);
    }, MIN_MS);

    return () => {
      window.clearInterval(tick);
      window.clearTimeout(done);
    };
  }, [ready]);

  return { splashDone: ready, progress };
}

export function AppSplash({ progress }: { progress: number }) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center px-6"
      style={{
        background: 'linear-gradient(165deg, #0f172a 0%, #1e293b 45%, #0f172a 100%)',
      }}
      role="status"
      aria-label="Chargement GESMAK"
    >
      <div className="relative">
        <img
          src="/logo-circle.png"
          alt="GESMAK"
          className="w-36 h-36 sm:w-40 sm:h-40 rounded-full object-cover shadow-2xl"
          style={{ animation: 'gesmakSplashPulse 1.6s ease-in-out infinite' }}
        />
        <div
          className="absolute -inset-2 rounded-full border-2 border-amber-400/30 pointer-events-none"
          style={{ animation: 'gesmakSplashRing 2s linear infinite' }}
        />
      </div>

      <h1
        className="mt-5 text-3xl font-black tracking-tight"
        style={{
          background: 'linear-gradient(90deg, #3b82f6, #f59e0b)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
        }}
      >
        GESMAK
      </h1>
      <p className="mt-1 text-xs sm:text-sm text-slate-400 text-center max-w-xs">
        Gestion Simplifiée, Business Maîtrisé
      </p>

      {/* Icônes modules */}
      <div className="mt-5 flex flex-wrap justify-center gap-3 text-[10px] text-slate-400 font-medium">
        {[
          { t: 'Stock', c: '#f59e0b' },
          { t: 'Caisse', c: '#3b82f6' },
          { t: 'Ventes', c: '#22c55e' },
          { t: 'Dépenses', c: '#a855f7' },
          { t: 'Rapports', c: '#38bdf8' },
        ].map((x) => (
          <span key={x.t} className="flex flex-col items-center gap-1 w-14">
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white"
              style={{ background: x.c }}
            >
              {x.t[0]}
            </span>
            {x.t}
          </span>
        ))}
      </div>

      {/* Barre de chargement qui se remplit */}
      <div className="mt-8 w-56 max-w-[70vw]">
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-[width] duration-100 ease-linear"
            style={{
              width: `${Math.max(6, progress)}%`,
              background: 'linear-gradient(90deg, #2563eb, #f59e0b)',
            }}
          />
        </div>
        <p className="mt-2 text-center text-[11px] text-slate-500">
          {progress < 100 ? 'Chargement…' : 'Prêt'}
        </p>
      </div>

      <p className="absolute bottom-6 text-[10px] text-slate-600">
        App créée par Kevin Akoh · Kevin Tech Pro
      </p>

      <style>{`
        @keyframes gesmakSplashPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
        @keyframes gesmakSplashRing {
          from { transform: rotate(0deg); opacity: .5; }
          to { transform: rotate(360deg); opacity: .5; }
        }
      `}</style>
    </div>
  );
}
