import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    label: 'Marine & or',
    desc: 'Bleu · or · blanc (référence resto)',
    navy: '#0b1f4a',
    gold: '#f5c518',
    cream: '#ffffff',
    ink: '#0b1f4a',
    dark: false,
  },
  {
    id: 'marine_sombre',
    label: 'Marine sombre',
    desc: 'Fond bleu nuit · or',
    navy: '#061228',
    gold: '#f5c518',
    cream: '#0a1628',
    ink: '#f8fafc',
    dark: true,
  },
  {
    id: 'orange_blanc',
    label: 'Orange & blanc',
    desc: 'Orange GESMAK · blanc · noir',
    navy: '#c2410c',
    gold: '#FF7900',
    cream: '#ffffff',
    ink: '#1c1917',
    dark: false,
  },
  {
    id: 'noir_blanc',
    label: 'Noir & blanc',
    desc: 'Noir · blanc · accent orange',
    navy: '#0c0a09',
    gold: '#FF7900',
    cream: '#fafaf9',
    ink: '#0c0a09',
    dark: false,
  },
  {
    id: 'minimal',
    label: 'Minimal',
    desc: 'Blanc simple · QR centré',
    navy: '#44403c',
    gold: '#292524',
    cream: '#ffffff',
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

/** Export PNG haute résolution (~A4 paysage 300 dpi zone utile). */
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

  const { theme: th, estName, tableNumber, phrase } = opts;
  const pad = 40;
  const r = 80;

  // Fond
  ctx.fillStyle = th.cream;
  roundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, r);
  ctx.fill();
  ctx.strokeStyle = th.navy;
  ctx.lineWidth = 18;
  ctx.stroke();

  // Bandes haut / bas
  ctx.fillStyle = th.navy;
  roundRect(ctx, W * 0.22, pad, W * 0.56, 120, 40);
  ctx.fill();
  roundRect(ctx, W * 0.18, H - pad - 140, W * 0.64, 140, 40);
  ctx.fill();

  // Bandes latérales or
  const gradL = ctx.createLinearGradient(0, 0, 0, H);
  gradL.addColorStop(0, th.gold);
  gradL.addColorStop(0.5, th.navy);
  gradL.addColorStop(1, th.gold);
  ctx.fillStyle = gradL;
  ctx.fillRect(pad + 8, H * 0.2, 28, H * 0.6);
  ctx.fillRect(W - pad - 36, H * 0.2, 28, H * 0.6);

  // Coins QR
  const qrImg = await loadImage(opts.qrSrc);
  const cornerSize = Math.min(W, H) * 0.22;
  const corners: [number, number][] = [
    [pad + 20, pad + 20],
    [W - pad - cornerSize - 20, pad + 20],
    [pad + 20, H - pad - cornerSize - 20],
    [W - pad - cornerSize - 20, H - pad - cornerSize - 20],
  ];
  for (const [x, y] of corners) {
    ctx.fillStyle = th.navy;
    roundRect(ctx, x, y, cornerSize, cornerSize, 36);
    ctx.fill();
    ctx.strokeStyle = th.gold;
    ctx.lineWidth = 10;
    ctx.stroke();
    const qi = cornerSize * 0.12;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, x + qi, y + qi, cornerSize - qi * 2, cornerSize - qi * 2.4, 16);
    ctx.fill();
    ctx.drawImage(qrImg, x + qi + 12, y + qi + 12, cornerSize - qi * 2 - 24, cornerSize - qi * 2 - 40);
    ctx.fillStyle = th.gold;
    ctx.font = `bold ${Math.round(cornerSize * 0.08)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Scannez ici', x + cornerSize / 2, y + cornerSize - qi * 0.6);
  }

  // Centre
  ctx.textAlign = 'center';
  ctx.fillStyle = th.gold;
  ctx.font = `bold ${Math.round(W * 0.022)}px sans-serif`;
  ctx.fillText('Scannez pour commander votre menu !', W / 2, H * 0.28);

  if (opts.logoUrl) {
    try {
      const logo = await loadImage(opts.logoUrl);
      const ls = Math.round(H * 0.12);
      ctx.save();
      ctx.beginPath();
      ctx.arc(W / 2, H * 0.36, ls / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(logo, W / 2 - ls / 2, H * 0.36 - ls / 2, ls, ls);
      ctx.restore();
      ctx.strokeStyle = th.gold;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(W / 2, H * 0.36, ls / 2, 0, Math.PI * 2);
      ctx.stroke();
    } catch {
      /* logo skip */
    }
  }

  ctx.fillStyle = th.ink;
  ctx.font = `bold ${Math.round(W * 0.045)}px Georgia, serif`;
  const name = (estName || 'Établissement').slice(0, 36);
  ctx.fillText(name, W / 2, H * 0.48);

  ctx.fillStyle = th.ink;
  ctx.globalAlpha = 0.75;
  ctx.font = `italic ${Math.round(W * 0.02)}px sans-serif`;
  ctx.fillText((phrase || '').slice(0, 50), W / 2, H * 0.53);
  ctx.globalAlpha = 1;

  // Badge table
  const badgeW = W * 0.22;
  const badgeH = H * 0.12;
  const bx = W / 2 - badgeW / 2;
  const by = H * 0.56;
  ctx.fillStyle = th.navy;
  roundRect(ctx, bx, by, badgeW, badgeH * 0.35, 12);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(W * 0.016)}px sans-serif`;
  ctx.fillText('TABLE N°', W / 2, by + badgeH * 0.25);
  ctx.fillStyle = th.gold;
  roundRect(ctx, bx, by + badgeH * 0.32, badgeW, badgeH * 0.55, 16);
  ctx.fill();
  ctx.fillStyle = th.navy;
  ctx.font = `bold ${Math.round(W * 0.055)}px sans-serif`;
  const tn = /^\d+$/.test(String(tableNumber)) ? `T${tableNumber}` : String(tableNumber);
  ctx.fillText(tn, W / 2, by + badgeH * 0.72);

  ctx.fillStyle = th.ink;
  ctx.globalAlpha = 0.55;
  ctx.font = `${Math.round(W * 0.016)}px sans-serif`;
  ctx.fillText('Cuisine  ·  Boissons  ·  Service', W / 2, H * 0.74);
  ctx.globalAlpha = 1;

  ctx.fillStyle = th.gold;
  ctx.font = `bold ${Math.round(W * 0.015)}px sans-serif`;
  ctx.fillText('Merci de votre visite · GESMAK', W / 2, H - pad - 50);

  const a = document.createElement('a');
  a.download = opts.fileName;
  a.href = canvas.toDataURL('image/png', 1.0);
  a.click();
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

function PlacematCard({
  estName,
  logoUrl,
  tableNumber,
  qrSrc,
  phrase,
  theme,
  cardRef,
}: {
  estName: string;
  logoUrl: string | null;
  tableNumber: string;
  qrSrc: string;
  phrase: string;
  theme: Theme;
  cardRef?: (el: HTMLElement | null) => void;
}) {
  const { navy, gold, cream, ink, dark } = theme;

  const Corner = ({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) => {
    const posCls =
      pos === 'tl'
        ? 'top-0 left-0 rounded-br-[2rem]'
        : pos === 'tr'
          ? 'top-0 right-0 rounded-bl-[2rem]'
          : pos === 'bl'
            ? 'bottom-0 left-0 rounded-tr-[2rem]'
            : 'bottom-0 right-0 rounded-tl-[2rem]';
    return (
      <div
        className={`absolute ${posCls} w-[26%] max-w-[130px] aspect-square flex flex-col items-center justify-center p-1.5 z-10`}
        style={{
          background: navy,
          boxShadow: `inset 0 0 0 2.5px ${gold}`,
        }}
      >
        <div className="bg-white rounded-md p-0.5 shadow w-[88%] aspect-square flex items-center justify-center">
          <img src={qrSrc} alt="" className="w-full h-full object-contain" />
        </div>
        <p className="text-[8px] font-semibold mt-0.5" style={{ color: gold }}>
          Scannez ici
        </p>
      </div>
    );
  };

  return (
    <article
      ref={cardRef as never}
      className="qr-print-card qr-nappe relative overflow-hidden print:break-inside-avoid"
      style={{
        background: cream,
        color: ink,
        aspectRatio: '1.4 / 1',
        minHeight: 260,
        borderRadius: 18,
        border: `3px solid ${navy}`,
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
    >
      <div
        className="absolute top-0 left-[22%] right-[22%] h-9 rounded-b-3xl z-[1]"
        style={{ background: navy }}
      />
      <div
        className="absolute bottom-0 left-[18%] right-[18%] h-11 rounded-t-3xl z-[1]"
        style={{ background: navy }}
      />
      <div
        className="absolute left-0 top-[20%] bottom-[20%] w-2.5 z-[1]"
        style={{ background: `linear-gradient(${gold}, ${navy}, ${gold})` }}
      />
      <div
        className="absolute right-0 top-[20%] bottom-[20%] w-2.5 z-[1]"
        style={{ background: `linear-gradient(${gold}, ${navy}, ${gold})` }}
      />

      <Corner pos="tl" />
      <Corner pos="tr" />
      <Corner pos="bl" />
      <Corner pos="br" />

      <div className="absolute inset-0 flex flex-col items-center justify-center z-[5] px-14 sm:px-16 text-center pointer-events-none">
        <p className="text-[10px] sm:text-[11px] font-bold tracking-wide mb-1" style={{ color: gold }}>
          Scannez pour commander votre menu !
        </p>
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-full bg-white border-2 shadow mb-1"
            style={{ borderColor: gold }}
            crossOrigin="anonymous"
          />
        ) : (
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mb-1 border-2"
            style={{ background: navy, borderColor: gold, color: gold }}
          >
            <QrCode size={24} />
          </div>
        )}
        <h2
          className="text-lg sm:text-2xl font-black leading-tight max-w-[72%]"
          style={{ color: ink, fontFamily: 'Georgia, serif' }}
        >
          {estName || 'Mon établissement'}
        </h2>
        <p className="text-[10px] italic opacity-80 mt-0.5 max-w-[70%]">{phrase}</p>
        <div className="mt-2 flex flex-col items-center">
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-t-lg"
            style={{ background: navy, color: '#fff' }}
          >
            Table N°
          </span>
          <span
            className="text-xl sm:text-2xl font-black px-5 py-0.5 rounded-b-xl min-w-[4rem]"
            style={{ background: gold, color: dark ? navy : navy }}
          >
            {/^\d+$/.test(String(tableNumber)) ? `T${tableNumber}` : tableNumber}
          </span>
        </div>
        <div className="flex gap-3 mt-2 text-[9px] opacity-60">
          <span>Cuisine</span>
          <span>·</span>
          <span>Boissons</span>
          <span>·</span>
          <span>Service</span>
        </div>
      </div>
      <p
        className="absolute bottom-1.5 left-0 right-0 text-center text-[9px] font-medium z-20"
        style={{ color: gold }}
      >
        Merci de votre visite · GESMAK
      </p>
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
  const [phrase, setPhrase] = useState('Bon goût, bonne ambiance !');
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
        const qr = qrImageUrl(url, { ...cfg, color: '0b1f4a', bg: 'ffffff' }, 512);
        await exportPlacematPng({
          estName,
          logoUrl,
          tableNumber: tb.number,
          phrase,
          qrSrc: qr,
          theme,
          fileName: `GESMAK-nappe-${estName || 'table'}-${tb.number}.png`.replace(/\s+/g, '-'),
        });
        await new Promise((r) => setTimeout(r, 400));
      }
      setExportMsg(`PNG haute qualité téléchargé (${visibleTables.length})`);
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
            4 QR · logo · n° table · PNG HD ou PDF (impression)
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
            PNG HD (JPG-quality)
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
          <label className="text-xs text-stone-400">Slogan (sous le nom)</label>
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
            const qr = qrImageUrl(url, { ...cfg, color: '0b1f4a', bg: 'ffffff' }, 280);
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
                            qrSrc: qrImageUrl(url, { ...cfg, color: '0b1f4a', bg: 'ffffff' }, 512),
                            theme,
                            fileName: `GESMAK-nappe-T${tb.number}.png`,
                          });
                          setExportMsg(`PNG table ${tb.number} téléchargé`);
                        } catch (e) {
                          setExportMsg(e instanceof Error ? e.message : 'Erreur');
                        } finally {
                          setExporting(false);
                        }
                      })();
                    }}
                  >
                    Télécharger PNG HD cette table
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
          html, body {
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * { visibility: hidden !important; }
          #qr-print-area, #qr-print-area * { visibility: visible !important; }
          #qr-print-area {
            position: absolute;
            left: 0; top: 0;
            width: 100%;
            padding: 0 !important;
            display: block !important;
            background: white !important;
          }
          #qr-print-area .qr-nappe {
            break-after: page;
            page-break-after: always;
            width: 100% !important;
            height: 180mm !important;
            max-height: 180mm !important;
            aspect-ratio: auto !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-shadow: none !important;
          }
          #qr-print-area .qr-nappe:last-child {
            break-after: auto;
            page-break-after: auto;
          }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
