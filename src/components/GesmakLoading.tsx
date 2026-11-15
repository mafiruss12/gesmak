/**
 * Chargements globaux GESMAK — même charte que le splash motion (Partie 1).
 * Variantes : full (écran entier) | page (zone contenu) | inline (petit).
 */
type Variant = 'full' | 'page' | 'inline';

export function GesmakLoading({
  label = 'Chargement…',
  variant = 'page',
}: {
  label?: string;
  variant?: Variant;
}) {
  const isFull = variant === 'full';
  const isInline = variant === 'inline';

  return (
    <div
      className={
        isFull
          ? 'fixed inset-0 z-[80] flex flex-col items-center justify-center overflow-hidden'
          : isInline
            ? 'flex flex-col items-center justify-center gap-2 py-6'
            : 'min-h-[40vh] flex flex-col items-center justify-center gap-3 py-10 px-4'
      }
      style={
        isFull
          ? {
              background:
                'linear-gradient(165deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
            }
          : undefined
      }
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      {isFull && (
        <>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(37,99,235,.2), transparent 55%)',
            }}
            aria-hidden
          />
        </>
      )}

      <div
        className={`relative flex items-center justify-center ${
          isInline ? 'w-12 h-12' : isFull ? 'w-[min(38vw,140px)] h-[min(38vw,140px)]' : 'w-16 h-16 sm:w-20 sm:h-20'
        }`}
      >
        {!isInline && (
          <>
            <span
              className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 border-r-amber-400 animate-spin"
              style={{ animationDuration: '1.8s' }}
              aria-hidden
            />
            <span
              className="absolute inset-[10%] rounded-full border border-transparent border-b-amber-400/70 border-l-blue-400/70 animate-spin"
              style={{ animationDuration: '2.6s', animationDirection: 'reverse' }}
              aria-hidden
            />
          </>
        )}
        <img
          src="/logo-circle.png"
          alt=""
          className={`relative z-[1] rounded-full object-cover shadow-lg ${
            isInline ? 'w-10 h-10' : 'w-[78%] h-[78%]'
          }`}
          draggable={false}
        />
      </div>

      {!isInline && (
        <>
          <p
            className={`font-black tracking-tight ${
              isFull ? 'mt-4 text-xl sm:text-2xl' : 'mt-1 text-base sm:text-lg'
            }`}
            style={{
              background: 'linear-gradient(90deg, #2563eb, #f59e0b)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            GESMAK
          </p>
          <p
            className={`text-center max-w-[260px] ${
              isFull ? 'text-slate-400 text-xs' : 'text-stone-500 text-xs sm:text-sm'
            }`}
          >
            {label}
          </p>
          <div
            className={`mt-3 h-1.5 rounded-full overflow-hidden ${
              isFull ? 'w-48 bg-white/10' : 'w-36 bg-stone-200 dark:bg-stone-700'
            }`}
          >
            <div
              className="h-full rounded-full gesmak-load-indeterminate"
              style={{
                background: 'linear-gradient(90deg, #2563eb, #f59e0b)',
                width: '40%',
              }}
            />
          </div>
        </>
      )}

      {isInline && (
        <p className="text-xs text-stone-500">{label}</p>
      )}

      <style dangerouslySetInnerHTML={{ __html: "\n        @keyframes gesmakLoadIndeterminate {\n          0% { transform: translateX(-120%); }\n          100% { transform: translateX(320%); }\n        }\n        .gesmak-load-indeterminate {\n          animation: gesmakLoadIndeterminate 1.15s ease-in-out infinite;\n        }\n        @media (prefers-reduced-motion: reduce) {\n          .gesmak-load-indeterminate { animation: none; width: 100% !important; }\n        }\n      " }} />
    </div>
  );
}
