import { useEffect, useState } from 'react';

const MIN_MS = 2800;
const SESSION_KEY = 'gesmak_splash_v1';

/**
 * Splash motion design GESMAK — responsive mobile / tablette / desktop.
 * S’inspire du logo animé (pulse, anneaux, reflets, entrée 3D).
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
    const boot = document.getElementById('gesmak-boot-splash');
    if (boot) {
      boot.style.transition = 'opacity .3s ease';
      boot.style.opacity = '0';
      window.setTimeout(() => boot.remove(), 320);
    }

    if (ready) return;

    const t0 = Date.now();
    const tick = window.setInterval(() => {
      const p = Math.min(100, ((Date.now() - t0) / MIN_MS) * 100);
      setProgress(p);
    }, 32);

    const done = window.setTimeout(() => {
      try {
        sessionStorage.setItem(SESSION_KEY, '1');
      } catch {
        /* */
      }
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

const MODULES = [
  { t: 'Stock', icon: '📦' },
  { t: 'Caisse', icon: '🧮' },
  { t: 'Ventes', icon: '📈' },
  { t: 'Dépenses', icon: '💳' },
  { t: 'Rapports', icon: '📄' },
] as const;

export function AppSplash({ progress }: { progress: number }) {
  return (
    <div
      className="gesmak-splash fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      role="status"
      aria-live="polite"
      aria-label="Chargement GESMAK"
    >
      <div className="gesmak-splash-bg" aria-hidden />
      <div className="gesmak-splash-orb gesmak-splash-orb-a" aria-hidden />
      <div className="gesmak-splash-orb gesmak-splash-orb-b" aria-hidden />

      <div className="gesmak-splash-logo-wrap">
        <div className="gesmak-splash-ring gesmak-splash-ring-outer" aria-hidden />
        <div className="gesmak-splash-ring gesmak-splash-ring-inner" aria-hidden />
        <div className="gesmak-splash-shine" aria-hidden />
        <img
          src="/logo-circle.png"
          alt="GESMAK"
          className="gesmak-splash-logo"
          draggable={false}
        />
      </div>

      <h1 className="gesmak-splash-title">
        <span className="gesmak-splash-ges">GES</span>
        <span className="gesmak-splash-mak">MAK</span>
      </h1>
      <p className="gesmak-splash-tagline">Gestion Simplifiée, Business Maîtrisé</p>

      <div className="gesmak-splash-modules">
        {MODULES.map((m) => (
          <div key={m.t} className="gesmak-splash-mod">
            <span className="gesmak-splash-mod-ico" aria-hidden>
              {m.icon}
            </span>
            <span>{m.t}</span>
          </div>
        ))}
      </div>

      <div className="gesmak-splash-bar-wrap">
        <div className="gesmak-splash-bar-track">
          <div
            className="gesmak-splash-bar-fill"
            style={{ width: `${Math.max(5, Math.min(100, progress))}%` }}
          />
        </div>
        <p className="gesmak-splash-bar-label">
          {progress < 98 ? 'Chargement…' : 'C’est parti'}
        </p>
      </div>

      <p className="gesmak-splash-credit">App créée par Kevin Akoh · Kevin Tech Pro</p>

      <style dangerouslySetInnerHTML={{ __html: "\n        .gesmak-splash {\n          padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right))\n            max(20px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));\n          background: #0b1220;\n        }\n        .gesmak-splash-bg {\n          position: absolute; inset: 0;\n          background:\n            radial-gradient(ellipse 80% 50% at 50% 0%, rgba(37,99,235,.25), transparent 55%),\n            radial-gradient(ellipse 60% 40% at 80% 80%, rgba(245,158,11,.12), transparent 50%),\n            linear-gradient(165deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);\n          animation: gesmakBgShift 8s ease-in-out infinite alternate;\n        }\n        .gesmak-splash-orb {\n          position: absolute; border-radius: 50%; filter: blur(40px); pointer-events: none;\n        }\n        .gesmak-splash-orb-a {\n          width: min(50vw, 280px); height: min(50vw, 280px);\n          top: 10%; left: -10%;\n          background: rgba(37, 99, 235, 0.35);\n          animation: gesmakOrb 6s ease-in-out infinite alternate;\n        }\n        .gesmak-splash-orb-b {\n          width: min(40vw, 220px); height: min(40vw, 220px);\n          bottom: 15%; right: -5%;\n          background: rgba(245, 158, 11, 0.28);\n          animation: gesmakOrb 7s ease-in-out infinite alternate-reverse;\n        }\n\n        .gesmak-splash-logo-wrap {\n          position: relative;\n          width: clamp(120px, 38vw, 200px);\n          height: clamp(120px, 38vw, 200px);\n          display: flex; align-items: center; justify-content: center;\n          animation: gesmakLogoIn 0.9s cubic-bezier(.2,.8,.2,1) both,\n                     gesmakLogoFloat 2.8s ease-in-out 0.9s infinite;\n        }\n        .gesmak-splash-logo {\n          width: 86%;\n          height: 86%;\n          object-fit: cover;\n          border-radius: 50%;\n          box-shadow:\n            0 0 0 3px rgba(255,255,255,.08),\n            0 16px 48px rgba(0,0,0,.45),\n            0 0 40px rgba(37,99,235,.25);\n          position: relative;\n          z-index: 2;\n          animation: gesmakLogoPulse 1.8s ease-in-out infinite;\n        }\n        .gesmak-splash-ring {\n          position: absolute; inset: 0; border-radius: 50%;\n          border: 2px solid transparent;\n          pointer-events: none;\n          z-index: 1;\n        }\n        .gesmak-splash-ring-outer {\n          border-top-color: #3b82f6;\n          border-right-color: #f59e0b;\n          animation: gesmakSpin 3.2s linear infinite;\n        }\n        .gesmak-splash-ring-inner {\n          inset: 6%;\n          border-bottom-color: #f59e0b;\n          border-left-color: #60a5fa;\n          animation: gesmakSpin 4.5s linear infinite reverse;\n          opacity: .7;\n        }\n        .gesmak-splash-shine {\n          position: absolute; inset: 8%;\n          border-radius: 50%;\n          background: linear-gradient(125deg, rgba(255,255,255,.22) 0%, transparent 42%);\n          z-index: 3;\n          pointer-events: none;\n          animation: gesmakShine 2.4s ease-in-out infinite;\n        }\n\n        .gesmak-splash-title {\n          margin-top: clamp(14px, 3.5vw, 22px);\n          font-size: clamp(1.65rem, 7vw, 2.35rem);\n          font-weight: 900;\n          letter-spacing: 0.02em;\n          line-height: 1.1;\n          animation: gesmakFadeUp 0.7s ease 0.25s both;\n        }\n        .gesmak-splash-ges {\n          background: linear-gradient(90deg, #2563eb, #60a5fa);\n          -webkit-background-clip: text; background-clip: text; color: transparent;\n        }\n        .gesmak-splash-mak {\n          background: linear-gradient(90deg, #f59e0b, #fbbf24);\n          -webkit-background-clip: text; background-clip: text; color: transparent;\n        }\n        .gesmak-splash-tagline {\n          margin-top: 6px;\n          font-size: clamp(0.7rem, 2.8vw, 0.9rem);\n          color: #94a3b8;\n          text-align: center;\n          max-width: min(90vw, 320px);\n          padding: 0 8px;\n          animation: gesmakFadeUp 0.7s ease 0.4s both;\n        }\n\n        .gesmak-splash-modules {\n          margin-top: clamp(16px, 4vw, 28px);\n          display: flex;\n          flex-wrap: wrap;\n          justify-content: center;\n          gap: clamp(8px, 2.5vw, 16px);\n          max-width: min(92vw, 420px);\n          animation: gesmakFadeUp 0.7s ease 0.55s both;\n        }\n        .gesmak-splash-mod {\n          display: flex;\n          flex-direction: column;\n          align-items: center;\n          gap: 4px;\n          width: clamp(52px, 16vw, 68px);\n          font-size: clamp(9px, 2.4vw, 11px);\n          font-weight: 600;\n          color: #94a3b8;\n        }\n        .gesmak-splash-mod-ico {\n          width: clamp(32px, 9vw, 40px);\n          height: clamp(32px, 9vw, 40px);\n          display: flex; align-items: center; justify-content: center;\n          border-radius: 12px;\n          background: rgba(255,255,255,.06);\n          border: 1px solid rgba(255,255,255,.1);\n          font-size: clamp(14px, 4vw, 18px);\n        }\n\n        .gesmak-splash-bar-wrap {\n          margin-top: clamp(22px, 5vw, 36px);\n          width: min(72vw, 240px);\n          animation: gesmakFadeUp 0.6s ease 0.65s both;\n        }\n        .gesmak-splash-bar-track {\n          height: 7px;\n          border-radius: 999px;\n          background: rgba(255,255,255,.1);\n          overflow: hidden;\n        }\n        .gesmak-splash-bar-fill {\n          height: 100%;\n          border-radius: 999px;\n          background: linear-gradient(90deg, #2563eb, #f59e0b, #fbbf24);\n          background-size: 200% 100%;\n          animation: gesmakBarShine 1.5s linear infinite;\n          transition: width 0.08s linear;\n          box-shadow: 0 0 12px rgba(245, 158, 11, 0.45);\n        }\n        .gesmak-splash-bar-label {\n          margin-top: 10px;\n          text-align: center;\n          font-size: 11px;\n          color: #64748b;\n        }\n\n        .gesmak-splash-credit {\n          position: absolute;\n          bottom: max(14px, env(safe-area-inset-bottom));\n          left: 0; right: 0;\n          text-align: center;\n          font-size: clamp(9px, 2.2vw, 11px);\n          color: #475569;\n          padding: 0 12px;\n        }\n\n        @media (min-width: 768px) {\n          .gesmak-splash-logo-wrap {\n            width: clamp(160px, 22vw, 220px);\n            height: clamp(160px, 22vw, 220px);\n          }\n        }\n        @media (max-height: 560px) {\n          .gesmak-splash-modules { margin-top: 10px; }\n          .gesmak-splash-bar-wrap { margin-top: 14px; }\n          .gesmak-splash-mod { width: 48px; }\n        }\n        @media (max-height: 420px) and (orientation: landscape) {\n          .gesmak-splash { flex-direction: row; flex-wrap: wrap; gap: 8px 24px; padding: 12px; }\n          .gesmak-splash-logo-wrap { width: 100px; height: 100px; }\n          .gesmak-splash-modules { display: none; }\n          .gesmak-splash-credit { display: none; }\n          .gesmak-splash-bar-wrap { width: 180px; margin-top: 0; }\n        }\n\n        @keyframes gesmakLogoIn {\n          from { opacity: 0; transform: scale(0.6) rotateY(-25deg); }\n          to { opacity: 1; transform: scale(1) rotateY(0); }\n        }\n        @keyframes gesmakLogoFloat {\n          0%, 100% { transform: translateY(0); }\n          50% { transform: translateY(-6px); }\n        }\n        @keyframes gesmakLogoPulse {\n          0%, 100% { transform: scale(1); }\n          50% { transform: scale(1.03); }\n        }\n        @keyframes gesmakSpin { to { transform: rotate(360deg); } }\n        @keyframes gesmakShine {\n          0%, 100% { opacity: 0.35; }\n          50% { opacity: 0.7; }\n        }\n        @keyframes gesmakFadeUp {\n          from { opacity: 0; transform: translateY(12px); }\n          to { opacity: 1; transform: translateY(0); }\n        }\n        @keyframes gesmakOrb {\n          from { transform: translate(0, 0); }\n          to { transform: translate(20px, -16px); }\n        }\n        @keyframes gesmakBgShift {\n          from { filter: hue-rotate(0deg); }\n          to { filter: hue-rotate(8deg); }\n        }\n        @keyframes gesmakBarShine {\n          0% { background-position: 0% 50%; }\n          100% { background-position: 200% 50%; }\n        }\n\n        @media (prefers-reduced-motion: reduce) {\n          .gesmak-splash-logo-wrap,\n          .gesmak-splash-logo,\n          .gesmak-splash-ring-outer,\n          .gesmak-splash-ring-inner,\n          .gesmak-splash-shine,\n          .gesmak-splash-orb,\n          .gesmak-splash-bar-fill {\n            animation: none !important;\n          }\n        }\n      " }} />
    </div>
  );
}
