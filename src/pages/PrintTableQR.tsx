import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  QrCode, Printer, Loader2, ArrowLeft, LayoutGrid, Download, Image as ImageIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  orderUrl,
  qrImageUrl,
  parseQrConfig,
  type QrConfig,
} from '@/lib/qrBranding';
import { EmptyState } from '@/components/ui';

type TableRow = { id: string; number: string; seats?: number; location?: string };

type ThemeId = 'marine_or' | 'marine_sombre' | 'orange_blanc' | 'noir_blanc' | 'minimal';

type Theme = {
  id: ThemeId;
  label: string;
  desc: string;
  navy: string;
  gold: string;
  cream: string;
  ink: string;
  dark: boolean;
};

const THEMES: Theme[] = [
  {
    id: 'marine_or',
    label: 'Noir & or (pro)',
    desc: 'Présentoir maquis · fond riche',
    navy: '#0a0a0a',
    gold: '#f5c518',
    cream: '#0a0a0a',
    ink: '#ffffff',
    dark: true,
  },
  {
    id: 'marine_sombre',
    label: 'Marine & or',
    desc: 'Bleu nuit profond · or',
    navy: '#061428',
    gold: '#f5c518',
    cream: '#061428',
    ink: '#ffffff',
    dark: true,
  },
  {
    id: 'orange_blanc',
    label: 'Orange & noir',
    desc: 'Orange GESMAK · fond noir',
    navy: '#1a0a00',
    gold: '#FF7900',
    cream: '#120800',
    ink: '#ffffff',
    dark: true,
  },
  {
    id: 'noir_blanc',
    label: 'Noir & blanc',
    desc: 'Élégant · accent orange',
    navy: '#050505',
    gold: '#FF7900',
    cream: '#0c0c0c',
    ink: '#fafafa',
    dark: true,
  },
  {
    id: 'minimal',
    label: 'Clair premium',
    desc: 'Blanc cassé · or',
    navy: '#1c1917',
    gold: '#b45309',
    cream: '#fffbeb',
    ink: '#1c1917',
    dark: false,
  },
];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image'));
    img.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** PNG HD — design présentoir (fond riche, nom large, badge table). */
async function exportPlacematPng(opts: {
  estName: string;
  logoUrl: string | null;
  tableNumber: string;
  phrase: string;
  qrSrc: string;
  theme: Theme;
  fileName: string;
}) {
  const W = 3508;
  const H = 2480;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponible');
  const th = opts.theme;

  // Fond dégradé riche
  const bg = ctx.createRadialGradient(W * 0.5, H * 0.45, 80, W * 0.5, H * 0.5, W * 0.7);
  bg.addColorStop(0, th.dark ? '#1a1a1a' : '#fff7ed');
  bg.addColorStop(0.45, th.cream);
  bg.addColorStop(1, th.navy);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Motifs décoratifs (cercles / lueur or)
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = th.gold;
  ctx.beginPath();
  ctx.arc(W * 0.15, H * 0.5, W * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W * 0.88, H * 0.35, W * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Cadre or double
  ctx.strokeStyle = th.gold;
  ctx.lineWidth = 14;
  roundRect(ctx, 48, 48, W - 96, H - 96, 48);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.5;
  roundRect(ctx, 72, 72, W - 144, H - 144, 36);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Feuilles / accents coins (formes)
  ctx.fillStyle = th.dark ? 'rgba(34,197,94,0.15)' : 'rgba(180,83,9,0.12)';
  for (const [fx, fy] of [
    [0, 0],
    [W, 0],
    [0, H],
    [W, H],
  ] as [number, number][]) {
    ctx.beginPath();
    ctx.ellipse(fx, fy, W * 0.2, H * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const qrImg = await loadImage(opts.qrSrc);
  const cornerSize = Math.min(W, H) * 0.2;
  const corners: [number, number][] = [
    [90, 90],
    [W - 90 - cornerSize, 90],
    [90, H - 90 - cornerSize],
    [W - 90 - cornerSize, H - 90 - cornerSize],
  ];
  for (const [x, y] of corners) {
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, x, y, cornerSize, cornerSize * 1.12, 28);
    ctx.fill();
    ctx.strokeStyle = th.gold;
    ctx.lineWidth = 8;
    ctx.stroke();
    const m = cornerSize * 0.1;
    ctx.drawImage(qrImg, x + m, y + m, cornerSize - m * 2, cornerSize - m * 2);
    ctx.fillStyle = th.navy;
    ctx.fillRect(x, y + cornerSize * 0.92, cornerSize, cornerSize * 0.2);
    ctx.fillStyle = th.gold;
    ctx.font = `bold ${Math.round(cornerSize * 0.09)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Scannez ici', x + cornerSize / 2, y + cornerSize * 1.06);
  }

  // Centre — logo grand
  ctx.textAlign = 'center';
  if (opts.logoUrl) {
    try {
      const logo = await loadImage(opts.logoUrl);
      const ls = Math.round(H * 0.16);
      ctx.save();
      ctx.beginPath();
      ctx.arc(W / 2, H * 0.28, ls / 2 + 12, 0, Math.PI * 2);
      ctx.fillStyle = th.gold;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(W / 2, H * 0.28, ls / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(logo, W / 2 - ls / 2, H * 0.28 - ls / 2, ls, ls);
      ctx.restore();
    } catch {
      /* */
    }
  }

  // Nom établissement — TRÈS grand
  ctx.fillStyle = th.gold;
  ctx.font = `bold ${Math.round(W * 0.07)}px Impact, Haettenschweiler, sans-serif`;
  const name = (opts.estName || 'ÉTABLISSEMENT').toUpperCase().slice(0, 28);
  // ombre
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillText(name, W / 2 + 6, H * 0.44 + 6);
  ctx.fillStyle = th.gold;
  ctx.fillText(name, W / 2, H * 0.44);

  // Ruban slogan
  ctx.fillStyle = th.gold;
  ctx.globalAlpha = 0.9;
  roundRect(ctx, W * 0.28, H * 0.47, W * 0.44, 8, 4);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = th.ink;
  ctx.font = `italic ${Math.round(W * 0.028)}px Georgia, serif`;
  ctx.fillText((opts.phrase || 'Bon repas, bonne ambiance !').slice(0, 48), W / 2, H * 0.52);

  // Badge TABLE
  const bw = W * 0.28;
  const bh = H * 0.18;
  const bx = W / 2 - bw / 2;
  const by = H * 0.56;
  // forme bouclier simplifiée
  ctx.fillStyle = th.gold;
  roundRect(ctx, bx, by, bw, bh, 28);
  ctx.fill();
  ctx.fillStyle = th.navy;
  ctx.font = `bold ${Math.round(W * 0.028)}px sans-serif`;
  ctx.fillText('TABLE', W / 2, by + bh * 0.32);
  ctx.font = `bold ${Math.round(W * 0.09)}px Impact, sans-serif`;
  const tn = String(opts.tableNumber).padStart(2, '0');
  ctx.fillText(tn, W / 2, by + bh * 0.78);

  // Textes latéraux
  ctx.fillStyle = th.gold;
  ctx.font = `bold ${Math.round(W * 0.02)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText('★ Savourez', W * 0.68, H * 0.58);
  ctx.fillText('★ Commandez', W * 0.68, H * 0.63);
  ctx.fillText('★ Profitez !', W * 0.68, H * 0.68);

  ctx.textAlign = 'center';
  ctx.font = `italic ${Math.round(W * 0.022)}px Georgia, serif`;
  ctx.fillStyle = th.ink;
  ctx.globalAlpha = 0.85;
  ctx.fillText('Votre satisfaction, notre priorité !', W / 2, H * 0.88);
  ctx.globalAlpha = 1;
  ctx.fillStyle = th.gold;
  ctx.font = `bold ${Math.round(W * 0.018)}px sans-serif`;
  ctx.fillText('GESMAK', W / 2, H * 0.93);

  const a = document.createElement('a');
  a.download = opts.fileName;
  a.href = canvas.toDataURL('image/png', 1.0);
  a.click();
}

function PlacematCard({
  estName,
  logoUrl,
  tableNumber,
  qrSrc,
  phrase,
  theme,
}: {
  estName: string;
  logoUrl: string | null;
  tableNumber: string;
  qrSrc: string;
  phrase: string;
  theme: Theme;
}) {
  const { navy, gold, cream, ink, dark } = theme;

  const Corner = ({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) => {
    const posCls =
      pos === 'tl'
        ? 'top-2 left-2'
        : pos === 'tr'
          ? 'top-2 right-2'
          : pos === 'bl'
            ? 'bottom-2 left-2'
            : 'bottom-2 right-2';
    return (
      <div className={`absolute ${posCls} z-20 w-[22%] max-w-[110px]`}>
        <div
          className="rounded-xl overflow-hidden bg-white shadow-lg"
          style={{ boxShadow: `0 0 0 2px ${gold}` }}
        >
          <img src={qrSrc} alt="" className="w-full aspect-square object-contain p-1" />
          <p
            className="text-center text-[7px] sm:text-[8px] font-bold py-0.5 leading-tight"
            style={{ background: navy, color: gold }}
          >
            Scannez ici
          </p>
        </div>
      </div>
    );
  };

  return (
    <article
      className="qr-print-card qr-nappe relative overflow-hidden print:break-inside-avoid"
      style={{
        background: dark
          ? `radial-gradient(ellipse at 50% 40%, #1f1f1f 0%, ${cream} 55%, ${navy} 100%)`
          : `radial-gradient(ellipse at 50% 40%, #fff 0%, ${cream} 70%, #fde68a 100%)`,
        color: ink,
        aspectRatio: '1.35 / 1',
        minHeight: 300,
        borderRadius: 20,
        border: `3px solid ${gold}`,
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        boxShadow: dark ? '0 12px 40px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.12)',
      }}
    >
      {/* lueurs décoratives */}
      <div
        className="absolute -left-8 top-1/3 w-32 h-32 rounded-full opacity-20 pointer-events-none"
        style={{ background: gold }}
      />
      <div
        className="absolute -right-6 bottom-1/4 w-28 h-28 rounded-full opacity-15 pointer-events-none"
        style={{ background: gold }}
      />
      <div
        className="absolute inset-2 rounded-[16px] pointer-events-none opacity-40"
        style={{ border: `1px solid ${gold}` }}
      />

      <Corner pos="tl" />
      <Corner pos="tr" />
      <Corner pos="bl" />
      <Corner pos="br" />

      {/* Centre pro */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-16 sm:px-20 text-center">
        {logoUrl ? (
          <div
            className="rounded-full p-1 mb-1 shadow-lg"
            style={{ background: gold }}
          >
            <img
              src={logoUrl}
              alt=""
              className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-full"
              crossOrigin="anonymous"
            />
          </div>
        ) : (
          <div
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mb-1 border-2"
            style={{ borderColor: gold, color: gold, background: 'rgba(0,0,0,0.3)' }}
          >
            <QrCode size={28} />
          </div>
        )}

        <h2
          className="text-2xl sm:text-3xl md:text-4xl font-black leading-none tracking-tight uppercase max-w-[78%]"
          style={{
            color: gold,
            textShadow: dark ? '0 3px 0 rgba(0,0,0,0.6), 0 0 24px rgba(245,197,24,0.25)' : 'none',
            fontFamily: 'Impact, Haettenschweiler, Arial Black, sans-serif',
          }}
        >
          {estName || 'Mon établissement'}
        </h2>

        <div className="w-24 h-1 rounded-full my-1.5" style={{ background: gold }} />

        <p
          className="text-xs sm:text-sm italic max-w-[70%] opacity-95"
          style={{ fontFamily: 'Georgia, serif' }}
        >
          {phrase || 'Bon repas, bonne ambiance !'}
        </p>

        {/* Badge table type bouclier */}
        <div
          className="mt-2 px-6 py-2 rounded-2xl min-w-[7rem] shadow-lg"
          style={{
            background: `linear-gradient(180deg, ${gold} 0%, #d4a017 100%)`,
            color: navy,
          }}
        >
          <p className="text-[10px] font-black tracking-widest opacity-80">TABLE</p>
          <p
            className="text-3xl sm:text-4xl font-black leading-none"
            style={{ fontFamily: 'Impact, sans-serif' }}
          >
            {String(tableNumber).padStart(2, '0')}
          </p>
        </div>

        <div className="mt-2 flex flex-col gap-0.5 text-[10px] font-semibold" style={{ color: gold }}>
          <span>★ Savourez · Commandez · Profitez !</span>
        </div>
        <p className="text-[9px] mt-1 opacity-70 italic">Votre satisfaction, notre priorité !</p>
      </div>
    </article>
  );
}

export default function PrintTableQR() {
  const { member, activeEstablishment } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState('');
  const [estName, setEstName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [qrCfg, setQrCfg] = useState<QrConfig>({});
  const [themeId, setThemeId] = useState<ThemeId>('marine_or');
  const [selected, setSelected] = useState<string | 'all'>('all');
  const [phrase, setPhrase] = useState('Bon repas, bonne ambiance !');
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const estKey = slug || estId || '';
  const cfg = useMemo(() => parseQrConfig(qrCfg), [qrCfg]);
  const theme = THEMES.find((t) => t.id === themeId) || THEMES[0];

  const load = useCallback(async () => {
    if (!estId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [tRes, eRes] = await Promise.all([
      supabase
        .from('restaurant_tables')
        .select('id, number, seats, location')
        .eq('establishment_id', estId)
        .order('number'),
      supabase
        .from('establishments')
        .select('name, slug, logo_url, cover_url, qr_config')
        .eq('id', estId)
        .maybeSingle(),
    ]);
    setTables((tRes.data as TableRow[]) || []);
    const e = eRes.data as Record<string, unknown> | null;
    if (e) {
      setEstName(String(e.name || ''));
      setSlug(String(e.slug || ''));
      setLogoUrl((e.logo_url as string) || (e.cover_url as string) || null);
      setQrCfg(parseQrConfig(e.qr_config));
      const welcome = String((e.qr_config as { welcome?: string })?.welcome || '').trim();
      if (welcome && welcome.length > 2) setPhrase(welcome);
    }
    setLoading(false);
  }, [estId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleTables = useMemo(() => {
    if (selected === 'all') return tables;
    return tables.filter((x) => x.id === selected);
  }, [tables, selected]);

  function cardUrl(tableNumber: string) {
    return orderUrl({
      origin,
      estKey,
      table: tableNumber,
      kiosk: cfg.kiosk_default !== false,
    });
  }

  async function downloadPngAll() {
    if (!visibleTables.length) return;
    setExporting(true);
    setExportMsg(null);
    try {
      for (const tb of visibleTables) {
        const url = cardUrl(tb.number);
        const qr = qrImageUrl(url, { ...cfg, color: '0a0a0a', bg: 'ffffff' }, 512);
        await exportPlacematPng({
          estName,
          logoUrl,
          tableNumber: tb.number,
          phrase,
          qrSrc: qr,
          theme,
          fileName: `GESMAK-nappe-${(estName || 'table').replace(/\s+/g, '-')}-T${tb.number}.png`,
        });
        await new Promise((r) => setTimeout(r, 400));
      }
      setExportMsg(`PNG HD téléchargé (${visibleTables.length})`);
    } catch (e) {
      setExportMsg(e instanceof Error ? e.message : 'Export échoué');
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-stone-400">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!estId) {
    return (
      <EmptyState
        icon={<QrCode size={48} />}
        title="Aucun établissement"
        message="Sélectionnez un établissement pour imprimer les QR."
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 print:hidden">
        <div>
          <Link to="/tables" className="text-xs text-amber-400 hover:underline flex items-center gap-1 mb-1">
            <ArrowLeft size={12} /> Tables
          </Link>
          <h1 className="text-2xl font-bold text-stone-100 flex items-center gap-2">
            <Printer className="text-amber-400" /> Nappes QR tables
          </h1>
          <p className="text-sm text-stone-400 mt-1">
            Style présentoir pro · logo & nom grands · PNG HD / PDF
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={exporting || !visibleTables.length}
            onClick={() => void downloadPngAll()}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            PNG HD
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Printer size={16} /> PDF / Imprimer
          </button>
        </div>
      </div>

      {exportMsg && (
        <p className="text-sm text-emerald-400 print:hidden flex items-center gap-1">
          <ImageIcon size={14} /> {exportMsg}
        </p>
      )}

      <div className="rounded-2xl border border-stone-800 bg-stone-900/60 p-4 space-y-3 print:hidden">
        <p className="text-xs font-semibold text-stone-400 uppercase">Couleurs / design</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {THEMES.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setThemeId(x.id)}
              className={`rounded-xl border p-3 text-left ${
                themeId === x.id ? 'border-amber-500 bg-amber-500/15' : 'border-stone-800 bg-stone-950'
              }`}
            >
              <div className="flex gap-1 mb-2 h-2 rounded-full overflow-hidden">
                <span className="flex-1" style={{ background: x.navy }} />
                <span className="flex-1" style={{ background: x.gold }} />
                <span className="flex-1" style={{ background: x.cream, border: '1px solid #444' }} />
              </div>
              <p className="text-sm font-semibold text-stone-100">{x.label}</p>
              <p className="text-[10px] text-stone-500">{x.desc}</p>
            </button>
          ))}
        </div>

        <div>
          <p className="text-xs font-semibold text-stone-400 uppercase mb-2">Tables</p>
          <select
            className="input w-full"
            value={selected}
            onChange={(e) => setSelected(e.target.value === 'all' ? 'all' : e.target.value)}
          >
            <option value="all">Toutes ({tables.length})</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                Table {t.number}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-stone-400">Slogan</label>
          <input
            className="input w-full mt-1"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            maxLength={80}
          />
        </div>
      </div>

      {tables.length === 0 ? (
        <EmptyState
          icon={<LayoutGrid size={48} />}
          title="Aucune table"
          message="Créez des tables puis imprimez les nappes."
        />
      ) : (
        <div id="qr-print-area" data-nappe="1" className="grid grid-cols-1 gap-4">
          {visibleTables.map((tb) => {
            const url = cardUrl(tb.number);
            const qr = qrImageUrl(url, { ...cfg, color: '0a0a0a', bg: 'ffffff' }, 280);
            return (
              <div key={tb.id} className="space-y-2">
                <PlacematCard
                  estName={estName}
                  logoUrl={logoUrl}
                  tableNumber={tb.number}
                  qrSrc={qr}
                  phrase={phrase}
                  theme={theme}
                />
                <div className="print:hidden flex justify-end">
                  <button
                    type="button"
                    disabled={exporting}
                    className="text-xs text-amber-400 underline"
                    onClick={() => {
                      void (async () => {
                        setExporting(true);
                        try {
                          await exportPlacematPng({
                            estName,
                            logoUrl,
                            tableNumber: tb.number,
                            phrase,
                            qrSrc: qrImageUrl(url, { ...cfg, color: '0a0a0a', bg: 'ffffff' }, 512),
                            theme,
                            fileName: `GESMAK-nappe-T${tb.number}.png`,
                          });
                          setExportMsg(`PNG table ${tb.number} OK`);
                        } catch (e) {
                          setExportMsg(e instanceof Error ? e.message : 'Erreur');
                        } finally {
                          setExporting(false);
                        }
                      })();
                    }}
                  >
                    PNG HD cette table
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 6mm; }
          html, body {
            background: #000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * { visibility: hidden !important; }
          #qr-print-area, #qr-print-area * { visibility: visible !important; }
          #qr-print-area {
            position: absolute; left: 0; top: 0; width: 100%;
            padding: 0 !important; display: block !important;
          }
          #qr-print-area .qr-nappe {
            break-after: page; page-break-after: always;
            width: 100% !important; height: 185mm !important;
            max-height: 185mm !important; aspect-ratio: auto !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-shadow: none !important;
          }
          #qr-print-area .qr-nappe:last-child {
            break-after: auto; page-break-after: auto;
          }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
