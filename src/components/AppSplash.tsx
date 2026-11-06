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

      <style>{`
        .gesmak-splash {
          padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right))
            max(20px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
          background: #0b1220;
        }
        .gesmak-splash-bg {
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 80% 50% at 50% 0%, rgba(37,99,235,.25), transparent 55%),
            radial-gradient(ellipse 60% 40% at 80% 80%, rgba(245,158,11,.12), transparent 50%),
            linear-gradient(165deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
          animation: gesmakBgShift 8s ease-in-out infinite alternate;
        }
        .gesmak-splash-orb {
          position: absolute; border-radius: 50%; filter: blur(40px); pointer-events: none;
        }
        .gesmak-splash-orb-a {
          width: min(50vw, 280px); height: min(50vw, 280px);
          top: 10%; left: -10%;
          background: rgba(37, 99, 235, 0.35);
          animation: gesmakOrb 6s ease-in-out infinite alternate;
        }
        .gesmak-splash-orb-b {
          width: min(40vw, 220px); height: min(40vw, 220px);
          bottom: 15%; right: -5%;
          background: rgba(245, 158, 11, 0.28);
          animation: gesmakOrb 7s ease-in-out infinite alternate-reverse;
        }

        .gesmak-splash-logo-wrap {
          position: relative;
          width: clamp(120px, 38vw, 200px);
          height: clamp(120px, 38vw, 200px);
          display: flex; align-items: center; justify-content: center;
          animation: gesmakLogoIn 0.9s cubic-bezier(.2,.8,.2,1) both,
                     gesmakLogoFloat 2.8s ease-in-out 0.9s infinite;
        }
        .gesmak-splash-logo {
          width: 86%;
          height: 86%;
          object-fit: cover;
          border-radius: 50%;
          box-shadow:
            0 0 0 3px rgba(255,255,255,.08),
            0 16px 48px rgba(0,0,0,.45),
            0 0 40px rgba(37,99,235,.25);
          position: relative;
          z-index: 2;
          animation: gesmakLogoPulse 1.8s ease-in-out infinite;
        }
        .gesmak-splash-ring {
          position: absolute; inset: 0; border-radius: 50%;
          border: 2px solid transparent;
          pointer-events: none;
          z-index: 1;
        }
        .gesmak-splash-ring-outer {
          border-top-color: #3b82f6;
          border-right-color: #f59e0b;
          animation: gesmakSpin 3.2s linear infinite;
        }
        .gesmak-splash-ring-inner {
          inset: 6%;
          border-bottom-color: #f59e0b;
          border-left-color: #60a5fa;
          animation: gesmakSpin 4.5s linear infinite reverse;
          opacity: .7;
        }
        .gesmak-splash-shine {
          position: absolute; inset: 8%;
          border-radius: 50%;
          background: linear-gradient(125deg, rgba(255,255,255,.22) 0%, transparent 42%);
          z-index: 3;
          pointer-events: none;
          animation: gesmakShine 2.4s ease-in-out infinite;
        }

        .gesmak-splash-title {
          margin-top: clamp(14px, 3.5vw, 22px);
          font-size: clamp(1.65rem, 7vw, 2.35rem);
          font-weight: 900;
          letter-spacing: 0.02em;
          line-height: 1.1;
          animation: gesmakFadeUp 0.7s ease 0.25s both;
        }
        .gesmak-splash-ges {
          background: linear-gradient(90deg, #2563eb, #60a5fa);
          -webkit-background-clip: text; background-clip: text; color: transparent;
        }
        .gesmak-splash-mak {
          background: linear-gradient(90deg, #f59e0b, #fbbf24);
          -webkit-background-clip: text; background-clip: text; color: transparent;
        }
        .gesmak-splash-tagline {
          margin-top: 6px;
          font-size: clamp(0.7rem, 2.8vw, 0.9rem);
          color: #94a3b8;
          text-align: center;
          max-width: min(90vw, 320px);
          padding: 0 8px;
          animation: gesmakFadeUp 0.7s ease 0.4s both;
        }

        .gesmak-splash-modules {
          margin-top: clamp(16px, 4vw, 28px);
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: clamp(8px, 2.5vw, 16px);
          max-width: min(92vw, 420px);
          animation: gesmakFadeUp 0.7s ease 0.55s both;
        }
        .gesmak-splash-mod {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          width: clamp(52px, 16vw, 68px);
          font-size: clamp(9px, 2.4vw, 11px);
          font-weight: 600;
          color: #94a3b8;
        }
        .gesmak-splash-mod-ico {
          width: clamp(32px, 9vw, 40px);
          height: clamp(32px, 9vw, 40px);
          display: flex; align-items: center; justify-content: center;
          border-radius: 12px;
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.1);
          font-size: clamp(14px, 4vw, 18px);
        }

        .gesmak-splash-bar-wrap {
          margin-top: clamp(22px, 5vw, 36px);
          width: min(72vw, 240px);
          animation: gesmakFadeUp 0.6s ease 0.65s both;
        }
        .gesmak-splash-bar-track {
          height: 7px;
          border-radius: 999px;
          background: rgba(255,255,255,.1);
          overflow: hidden;
        }
        .gesmak-splash-bar-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #2563eb, #f59e0b, #fbbf24);
          background-size: 200% 100%;
          animation: gesmakBarShine 1.5s linear infinite;
          transition: width 0.08s linear;
          box-shadow: 0 0 12px rgba(245, 158, 11, 0.45);
        }
        .gesmak-splash-bar-label {
          margin-top: 10px;
          text-align: center;
          font-size: 11px;
          color: #64748b;
        }

        .gesmak-splash-credit {
          position: absolute;
          bottom: max(14px, env(safe-area-inset-bottom));
          left: 0; right: 0;
          text-align: center;
          font-size: clamp(9px, 2.2vw, 11px);
          color: #475569;
          padding: 0 12px;
        }

        @media (min-width: 768px) {
          .gesmak-splash-logo-wrap {
            width: clamp(160px, 22vw, 220px);
            height: clamp(160px, 22vw, 220px);
          }
        }
        @media (max-height: 560px) {
          .gesmak-splash-modules { margin-top: 10px; }
          .gesmak-splash-bar-wrap { margin-top: 14px; }
          .gesmak-splash-mod { width: 48px; }
        }
        @media (max-height: 420px) and (orientation: landscape) {
          .gesmak-splash { flex-direction: row; flex-wrap: wrap; gap: 8px 24px; padding: 12px; }
          .gesmak-splash-logo-wrap { width: 100px; height: 100px; }
          .gesmak-splash-modules { display: none; }
          .gesmak-splash-credit { display: none; }
          .gesmak-splash-bar-wrap { width: 180px; margin-top: 0; }
        }

        @keyframes gesmakLogoIn {
          from { opacity: 0; transform: scale(0.6) rotateY(-25deg); }
          to { opacity: 1; transform: scale(1) rotateY(0); }
        }
        @keyframes gesmakLogoFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes gesmakLogoPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
        @keyframes gesmakSpin { to { transform: rotate(360deg); } }
        @keyframes gesmakShine {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.7; }
        }
        @keyframes gesmakFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes gesmakOrb {
          from { transform: translate(0, 0); }
          to { transform: translate(20px, -16px); }
        }
        @keyframes gesmakBgShift {
          from { filter: hue-rotate(0deg); }
          to { filter: hue-rotate(8deg); }
        }
        @keyframes gesmakBarShine {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }

        @media (prefers-reduced-motion: reduce) {
          .gesmak-splash-logo-wrap,
          .gesmak-splash-logo,
          .gesmak-splash-ring-outer,
          .gesmak-splash-ring-inner,
          .gesmak-splash-shine,
          .gesmak-splash-orb,
          .gesmak-splash-bar-fill {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
