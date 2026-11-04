import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  QrCode, Printer, Loader2, ArrowLeft, LayoutGrid, Download, Image as ImageIcon,
  UtensilsCrossed, Smile, ThumbsUp, GlassWater, ChefHat,
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

type ThemeId = 'maquis_photo' | 'marine_or' | 'orange_noir' | 'noir_or' | 'clair';

type Theme = {
  id: ThemeId;
  label: string;
  desc: string;
  navy: string;
  gold: string;
  cream: string;
  ink: string;
  dark: boolean;
  /** Photos décor (gauche / droite) */
  foodLeft: string;
  foodRight: string;
};

/** Images librement utilisables (Unsplash) — plats & boissons maquis */
const IMG = {
  wings:
    'https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=600&q=80',
  skewers:
    'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80',
  juice:
    'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?auto=format&fit=crop&w=400&q=80',
  cocktail:
    'https://images.unsplash.com/photo-1514362545857-3bc16549766b?auto=format&fit=crop&w=400&q=80',
  beer:
    'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=400&q=80',
  grill:
    'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
  palm:
    'https://images.unsplash.com/photo-1615233500064-caa995e2f9dd?auto=format&fit=crop&w=400&q=60',
};

const THEMES: Theme[] = [
  {
    id: 'maquis_photo',
    label: 'Maquis photo (pro)',
    desc: 'Fond noir · grillades · boissons',
    navy: '#050505',
    gold: '#f5c518',
    cream: '#0a0a0a',
    ink: '#ffffff',
    dark: true,
    foodLeft: IMG.wings,
    foodRight: IMG.skewers,
  },
  {
    id: 'marine_or',
    label: 'Marine & or',
    desc: 'Bleu nuit · fruits de mer style',
    navy: '#061428',
    gold: '#f5c518',
    cream: '#061428',
    ink: '#ffffff',
    dark: true,
    foodLeft: IMG.grill,
    foodRight: IMG.cocktail,
  },
  {
    id: 'orange_noir',
    label: 'Orange & noir',
    desc: 'GESMAK · bière & grill',
    navy: '#1a0800',
    gold: '#FF7900',
    cream: '#120500',
    ink: '#ffffff',
    dark: true,
    foodLeft: IMG.beer,
    foodRight: IMG.grill,
  },
  {
    id: 'noir_or',
    label: 'Noir & or classic',
    desc: 'Élégant · jus & brochettes',
    navy: '#000000',
    gold: '#eab308',
    cream: '#0c0c0c',
    ink: '#fafafa',
    dark: true,
    foodLeft: IMG.juice,
    foodRight: IMG.skewers,
  },
  {
    id: 'clair',
    label: 'Clair premium',
    desc: 'Fond clair · accents or',
    navy: '#1c1917',
    gold: '#b45309',
    cream: '#fffbeb',
    ink: '#1c1917',
    dark: false,
    foodLeft: IMG.wings,
    foodRight: IMG.juice,
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

  // Fond
  const bg = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W * 0.65);
  bg.addColorStop(0, th.dark ? '#1a1a1a' : '#fffbeb');
  bg.addColorStop(1, th.cream);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Photos plats gauche / droite
  try {
    const left = await loadImage(th.foodLeft);
    const right = await loadImage(th.foodRight);
    ctx.save();
    ctx.globalAlpha = 0.95;
    // gauche bas
    roundRect(ctx, W * 0.04, H * 0.32, W * 0.28, H * 0.42, 40);
    ctx.clip();
    ctx.drawImage(left, W * 0.02, H * 0.28, W * 0.32, H * 0.5);
    ctx.restore();
    ctx.save();
    roundRect(ctx, W * 0.68, H * 0.28, W * 0.28, H * 0.45, 40);
    ctx.clip();
    ctx.drawImage(right, W * 0.66, H * 0.24, W * 0.32, H * 0.52);
    ctx.restore();
    // vinylettes or
    ctx.strokeStyle = th.gold;
    ctx.lineWidth = 6;
    ctx.globalAlpha = 0.7;
    roundRect(ctx, W * 0.04, H * 0.32, W * 0.28, H * 0.42, 40);
    ctx.stroke();
    roundRect(ctx, W * 0.68, H * 0.28, W * 0.28, H * 0.45, 40);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } catch {
    /* photos optionnelles */
  }

  // Lueurs feuilles (cercles verts)
  ctx.fillStyle = 'rgba(34,197,94,0.12)';
  ctx.beginPath();
  ctx.ellipse(0, 0, W * 0.25, H * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(W, H, W * 0.28, H * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cadre or
  ctx.strokeStyle = th.gold;
  ctx.lineWidth = 16;
  roundRect(ctx, 36, 36, W - 72, H - 72, 32);
  ctx.stroke();

  const qrImg = await loadImage(opts.qrSrc);
  const cs = Math.min(W, H) * 0.18;
  const corners: [number, number][] = [
    [70, 70],
    [W - 70 - cs, 70],
    [70, H - 70 - cs * 1.15],
    [W - 70 - cs, H - 70 - cs * 1.15],
  ];
  for (const [x, y] of corners) {
    ctx.fillStyle = th.navy;
    roundRect(ctx, x - 8, y - 8, cs + 16, cs * 1.2, 24);
    ctx.fill();
    ctx.strokeStyle = th.gold;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    roundRect(ctx, x, y, cs, cs, 12);
    ctx.fill();
    ctx.drawImage(qrImg, x + 10, y + 10, cs - 20, cs - 20);
    ctx.fillStyle = th.gold;
    ctx.font = `bold ${Math.round(cs * 0.1)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Scannez ici', x + cs / 2, y + cs + 28);
  }

  ctx.textAlign = 'center';

  // Logo
  if (opts.logoUrl) {
    try {
      const logo = await loadImage(opts.logoUrl);
      const ls = H * 0.14;
      ctx.beginPath();
      ctx.arc(W / 2, H * 0.26, ls / 2 + 10, 0, Math.PI * 2);
      ctx.fillStyle = th.gold;
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(W / 2, H * 0.26, ls / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(logo, W / 2 - ls / 2, H * 0.26 - ls / 2, ls, ls);
      ctx.restore();
    } catch {
      /* */
    }
  }

  // Nom grand
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.font = `bold ${Math.round(W * 0.065)}px Impact, sans-serif`;
  const name = (opts.estName || 'MAQUIS').toUpperCase().slice(0, 26);
  ctx.fillText(name, W / 2 + 4, H * 0.42 + 4);
  ctx.fillStyle = th.gold;
  ctx.fillText(name, W / 2, H * 0.42);

  ctx.fillStyle = th.ink;
  ctx.font = `italic ${Math.round(W * 0.026)}px Georgia, serif`;
  ctx.fillText((opts.phrase || 'Bon repas, bonne ambiance !').slice(0, 50), W / 2, H * 0.49);

  // Badge table
  const bw = W * 0.24;
  const bh = H * 0.14;
  const bx = W / 2 - bw / 2;
  const by = H * 0.53;
  ctx.fillStyle = th.gold;
  roundRect(ctx, bx, by, bw, bh, 24);
  ctx.fill();
  ctx.fillStyle = th.navy;
  ctx.font = `bold ${Math.round(W * 0.022)}px sans-serif`;
  ctx.fillText('TABLE', W / 2, by + bh * 0.35);
  ctx.font = `bold ${Math.round(W * 0.07)}px Impact, sans-serif`;
  ctx.fillText(String(opts.tableNumber).padStart(2, '0'), W / 2, by + bh * 0.82);

  // Icônes texte
  ctx.fillStyle = th.gold;
  ctx.font = `bold ${Math.round(W * 0.02)}px sans-serif`;
  ctx.fillText('🍽  Savourez    ·    😊  Commandez    ·    👍  Profitez', W / 2, H * 0.74);

  ctx.font = `italic ${Math.round(W * 0.02)}px Georgia, serif`;
  ctx.fillStyle = th.ink;
  ctx.globalAlpha = 0.9;
  ctx.fillText('Votre satisfaction, notre priorité !', W / 2, H * 0.82);
  ctx.globalAlpha = 1;
  ctx.fillStyle = th.gold;
  ctx.font = `bold ${Math.round(W * 0.018)}px sans-serif`;
  ctx.fillText((opts.estName || 'GESMAK').slice(0, 30), W / 2, H * 0.88);

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
  const { navy, gold, cream, ink, dark, foodLeft, foodRight } = theme;

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
      <div className={`absolute ${posCls} z-30 w-[20%] max-w-[100px]`}>
        <div
          className="rounded-xl overflow-hidden shadow-xl"
          style={{ background: navy, boxShadow: `0 0 0 2px ${gold}` }}
        >
          <div className="bg-white m-1 rounded-lg overflow-hidden">
            <img src={qrSrc} alt="" className="w-full aspect-square object-contain" />
          </div>
          <p className="text-center text-[7px] font-bold pb-1 leading-tight" style={{ color: gold }}>
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
          ? `radial-gradient(ellipse at 50% 45%, #222 0%, ${cream} 55%, ${navy} 100%)`
          : `radial-gradient(ellipse at 50% 40%, #fff 0%, ${cream} 80%)`,
        color: ink,
        aspectRatio: '1.4 / 1',
        minHeight: 320,
        borderRadius: 18,
        border: `3px solid ${gold}`,
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
    >
      {/* Photos plats */}
      <img
        src={foodLeft}
        alt=""
        className="absolute left-0 top-[28%] w-[30%] h-[45%] object-cover rounded-r-3xl opacity-90 z-[5] pointer-events-none"
        style={{ boxShadow: `4px 0 20px rgba(0,0,0,0.4)` }}
        crossOrigin="anonymous"
      />
      <img
        src={foodRight}
        alt=""
        className="absolute right-0 top-[24%] w-[30%] h-[48%] object-cover rounded-l-3xl opacity-90 z-[5] pointer-events-none"
        style={{ boxShadow: `-4px 0 20px rgba(0,0,0,0.4)` }}
        crossOrigin="anonymous"
      />

      {/* Feuilles décor */}
      <div
        className="absolute -top-4 -left-4 w-24 h-24 rounded-full opacity-25 z-[1] pointer-events-none"
        style={{ background: 'radial-gradient(circle, #22c55e 0%, transparent 70%)' }}
      />
      <div
        className="absolute -bottom-6 -right-4 w-28 h-28 rounded-full opacity-20 z-[1] pointer-events-none"
        style={{ background: 'radial-gradient(circle, #22c55e 0%, transparent 70%)' }}
      />

      <Corner pos="tl" />
      <Corner pos="tr" />
      <Corner pos="bl" />
      <Corner pos="br" />

      <div className="absolute inset-0 flex flex-col items-center justify-center z-20 px-[32%] text-center">
        <div className="mb-0.5" style={{ color: gold }}>
          <ChefHat size={28} className="mx-auto drop-shadow" />
        </div>
        {logoUrl ? (
          <div className="rounded-full p-[3px] mb-1" style={{ background: gold }}>
            <img
              src={logoUrl}
              alt=""
              className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-full"
              crossOrigin="anonymous"
            />
          </div>
        ) : null}

        <h2
          className="text-xl sm:text-3xl font-black leading-none uppercase tracking-tight max-w-full"
          style={{
            color: gold,
            textShadow: dark ? '0 2px 8px rgba(0,0,0,0.8)' : 'none',
            fontFamily: 'Impact, Haettenschweiler, Arial Black, sans-serif',
          }}
        >
          {estName || 'Mon Maquis'}
        </h2>

        <p className="text-[11px] sm:text-xs italic mt-1 opacity-95" style={{ fontFamily: 'Georgia, serif' }}>
          {phrase || 'Bon repas, bonne ambiance !'}
        </p>

        <div
          className="mt-2 px-5 py-1.5 rounded-2xl shadow-lg"
          style={{ background: `linear-gradient(180deg, ${gold}, #c9a227)`, color: navy }}
        >
          <p className="text-[9px] font-black tracking-widest">TABLE</p>
          <p className="text-2xl sm:text-3xl font-black leading-none" style={{ fontFamily: 'Impact, sans-serif' }}>
            {String(tableNumber).padStart(2, '0')}
          </p>
        </div>

        <div className="mt-2 flex items-center justify-center gap-2 text-[9px] sm:text-[10px] font-semibold" style={{ color: gold }}>
          <span className="flex items-center gap-0.5"><UtensilsCrossed size={12} /> Savourez</span>
          <span className="opacity-40">|</span>
          <span className="flex items-center gap-0.5"><Smile size={12} /> Commandez</span>
          <span className="opacity-40">|</span>
          <span className="flex items-center gap-0.5"><ThumbsUp size={12} /> Profitez</span>
        </div>
        <p className="text-[9px] mt-1 opacity-70 italic flex items-center gap-1 justify-center">
          <GlassWater size={11} style={{ color: gold }} /> Votre satisfaction, notre priorité !
        </p>
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
  const [themeId, setThemeId] = useState<ThemeId>('maquis_photo');
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
        await new Promise((r) => setTimeout(r, 500));
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
            Photos plats & boissons · icônes · style présentoir maquis
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
          <button type="button" onClick={() => window.print()} className="btn-primary flex items-center gap-2 text-sm">
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
        <p className="text-xs font-semibold text-stone-400 uppercase">Thèmes arrière-plan</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {THEMES.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setThemeId(x.id)}
              className={`rounded-xl border p-2 text-left overflow-hidden ${
                themeId === x.id ? 'border-amber-500 bg-amber-500/15' : 'border-stone-800 bg-stone-950'
              }`}
            >
              <div className="flex gap-0.5 h-10 rounded-lg overflow-hidden mb-1.5">
                <img src={x.foodLeft} alt="" className="w-1/2 object-cover" />
                <img src={x.foodRight} alt="" className="w-1/2 object-cover" />
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
          @page { size: A4 landscape; margin: 5mm; }
          html, body {
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
            width: 100% !important; height: 188mm !important;
            max-height: 188mm !important; aspect-ratio: auto !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
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
