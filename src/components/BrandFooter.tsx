/** Signature Kevin Tech Pro — logo KTP distinct du logo Stock Manager */
const SOCIALS = [
  { label: 'Facebook', href: 'https://www.facebook.com/search/top?q=kevin%20tech%20pro' },
  { label: 'TikTok', href: 'https://www.tiktok.com/search?q=kevin%20tech%20pro' },
];

export default function BrandFooter({
  compact = false,
  light = false,
}: {
  compact?: boolean;
  /** Style clair pour page login (carte blanche) */
  light?: boolean;
}) {
  const border = light ? 'border-t border-stone-200' : 'border-t border-stone-800/80';
  const bg = light ? 'bg-transparent' : 'bg-stone-950/80';
  const titleMuted = light ? 'text-stone-500' : 'text-stone-400';
  const titleStrong = light ? 'text-stone-800' : 'text-stone-300';
  const powered = light ? 'text-orange-600' : 'text-amber-400';
  const social = light ? 'text-stone-500 hover:text-orange-600' : 'text-stone-400 hover:text-amber-400';
  const copy = light ? 'text-stone-400' : 'text-stone-600';

  return (
    <footer
      data-no-print
      className={`brand-footer ${border} ${bg} ${compact || light ? 'px-2 py-3' : 'px-4 py-4'}`}
    >
      <div className="max-w-lg mx-auto flex flex-col items-center gap-1.5 text-center">
        <div className="flex items-center gap-2">
          <img
            src="/kevin-tech-pro-logo.png"
            alt="Kevin Tech Pro"
            className={`rounded-lg object-contain bg-white p-0.5 ${compact || light ? 'h-7 w-7' : 'h-9 w-9'}`}
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/kevin-tech-pro-logo.jpg';
            }}
          />
          <div className="text-left">
            <p className={`text-[11px] ${titleMuted} leading-tight`}>
              <span className={`${titleStrong} font-semibold`}>Stock Manager AI</span>
            </p>
            <p className={`text-xs font-bold ${powered} leading-tight`}>
              App créée par Kevin Akoh de Kevin Tech Pro
            </p>
          </div>
        </div>
        {!compact && (
          <>
            <div className="flex flex-wrap justify-center gap-3 text-[11px]">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${social} underline-offset-2 hover:underline`}
                >
                  {s.label}
                </a>
              ))}
            </div>
            <p className={`text-[10px] ${copy}`}>
              © {new Date().getFullYear()} Kevin Akoh — Kevin Tech Pro
            </p>
          </>
        )}
        {compact && light && (
          <p className={`text-[10px] ${copy}`}>
            © {new Date().getFullYear()} Kevin Akoh — Kevin Tech Pro
          </p>
        )}
      </div>
    </footer>
  );
}
