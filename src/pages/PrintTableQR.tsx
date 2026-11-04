import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  QrCode, Printer, Loader2, ArrowLeft, LayoutGrid, Download, Image as ImageIcon,
  UtensilsCrossed, Smile, ThumbsUp, GlassWater, ChefHat, Plus, Trash2, Save, Settings2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { orderUrl, qrImageUrl, parseQrConfig, type QrConfig } from '@/lib/qrBranding';
import { uploadVitrineImage } from '@/lib/publicMedia';
import { EmptyState } from '@/components/ui';
import {
  type PlacematTheme,
  type PlacematSettings,
  DEFAULT_THEMES,
  DEFAULT_PLACEMAT,
  parsePlacemat,
  allThemes,
  resolveTheme,
  newThemeId,
} from '@/lib/placematThemes';

type TableRow = { id: string; number: string; seats?: number; location?: string };

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
  x: number, y: number, w: number, h: number, r: number,
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
  settings: PlacematSettings;
  theme: PlacematTheme;
  qrSrc: string;
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
  const s = opts.settings;

  const bg = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W * 0.65);
  bg.addColorStop(0, th.dark ? '#1a1a1a' : '#fffbeb');
  bg.addColorStop(1, th.cream);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  if (s.showFood) {
    try {
      const left = await loadImage(th.foodLeft);
      const right = await loadImage(th.foodRight);
      ctx.save();
      roundRect(ctx, W * 0.04, H * 0.32, W * 0.28, H * 0.42, 40);
      ctx.clip();
      ctx.drawImage(left, W * 0.02, H * 0.28, W * 0.32, H * 0.5);
      ctx.restore();
      ctx.save();
      roundRect(ctx, W * 0.68, H * 0.28, W * 0.28, H * 0.45, 40);
      ctx.clip();
      ctx.drawImage(right, W * 0.66, H * 0.24, W * 0.32, H * 0.52);
      ctx.restore();
      ctx.strokeStyle = th.gold;
      ctx.lineWidth = 6;
      ctx.globalAlpha = 0.7;
      roundRect(ctx, W * 0.04, H * 0.32, W * 0.28, H * 0.42, 40);
      ctx.stroke();
      roundRect(ctx, W * 0.68, H * 0.28, W * 0.28, H * 0.45, 40);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } catch { /* */ }
  }

  ctx.fillStyle = 'rgba(34,197,94,0.12)';
  ctx.beginPath();
  ctx.ellipse(0, 0, W * 0.25, H * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(W, H, W * 0.28, H * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = th.gold;
  ctx.lineWidth = 16;
  roundRect(ctx, 36, 36, W - 72, H - 72, 32);
  ctx.stroke();

  const qrImg = await loadImage(opts.qrSrc);
  const cs = Math.min(W, H) * 0.18;
  const corners: [number, number][] = [
    [70, 70], [W - 70 - cs, 70],
    [70, H - 70 - cs * 1.15], [W - 70 - cs, H - 70 - cs * 1.15],
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
    ctx.fillText(s.scanLabel.slice(0, 18), x + cs / 2, y + cs + 28);
  }

  ctx.textAlign = 'center';
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
    } catch { /* */ }
  }

  const name = (opts.estName || 'MAQUIS').toUpperCase().slice(0, 26);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.font = `bold ${Math.round(W * 0.065)}px Impact, sans-serif`;
  ctx.fillText(name, W / 2 + 4, H * 0.42 + 4);
  ctx.fillStyle = th.gold;
  ctx.fillText(name, W / 2, H * 0.42);

  ctx.fillStyle = th.ink;
  ctx.font = `italic ${Math.round(W * 0.026)}px Georgia, serif`;
  ctx.fillText(s.slogan.slice(0, 50), W / 2, H * 0.49);

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

  if (s.showIcons) {
    ctx.fillStyle = th.gold;
    ctx.font = `bold ${Math.round(W * 0.02)}px sans-serif`;
    ctx.fillText('🍽  Savourez    ·    😊  Commandez    ·    👍  Profitez', W / 2, H * 0.74);
  }

  ctx.font = `italic ${Math.round(W * 0.02)}px Georgia, serif`;
  ctx.fillStyle = th.ink;
  ctx.globalAlpha = 0.9;
  ctx.fillText(s.footerLine.slice(0, 60), W / 2, H * 0.82);
  ctx.globalAlpha = 1;
  ctx.fillStyle = th.gold;
  ctx.font = `bold ${Math.round(W * 0.018)}px sans-serif`;
  ctx.fillText((s.brandLine || opts.estName || 'GESMAK').slice(0, 30), W / 2, H * 0.88);

  const a = document.createElement('a');
  a.download = opts.fileName;
  a.href = canvas.toDataURL('image/png', 1.0);
  a.click();
}

function PlacematCard({
  estName, logoUrl, tableNumber, qrSrc, settings, theme,
}: {
  estName: string;
  logoUrl: string | null;
  tableNumber: string;
  qrSrc: string;
  settings: PlacematSettings;
  theme: PlacematTheme;
}) {
  const { navy, gold, cream, ink, dark, foodLeft, foodRight } = theme;

  const Corner = ({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) => {
    const posCls =
      pos === 'tl' ? 'top-2 left-2' : pos === 'tr' ? 'top-2 right-2'
        : pos === 'bl' ? 'bottom-2 left-2' : 'bottom-2 right-2';
    return (
      <div className={`absolute ${posCls} z-30 w-[20%] max-w-[100px]`}>
        <div className="rounded-xl overflow-hidden shadow-xl" style={{ background: navy, boxShadow: `0 0 0 2px ${gold}` }}>
          <div className="bg-white m-1 rounded-lg overflow-hidden">
            <img src={qrSrc} alt="" className="w-full aspect-square object-contain" />
          </div>
          <p className="text-center text-[7px] font-bold pb-1 leading-tight" style={{ color: gold }}>
            {settings.scanLabel}
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
      {settings.showFood && (
        <>
          <img src={foodLeft} alt="" className="absolute left-0 top-[28%] w-[30%] h-[45%] object-cover rounded-r-3xl opacity-90 z-[5] pointer-events-none" crossOrigin="anonymous" />
          <img src={foodRight} alt="" className="absolute right-0 top-[24%] w-[30%] h-[48%] object-cover rounded-l-3xl opacity-90 z-[5] pointer-events-none" crossOrigin="anonymous" />
        </>
      )}
      <div className="absolute -top-4 -left-4 w-24 h-24 rounded-full opacity-25 z-[1]" style={{ background: 'radial-gradient(circle, #22c55e 0%, transparent 70%)' }} />
      <div className="absolute -bottom-6 -right-4 w-28 h-28 rounded-full opacity-20 z-[1]" style={{ background: 'radial-gradient(circle, #22c55e 0%, transparent 70%)' }} />

      <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />

      <div className="absolute inset-0 flex flex-col items-center justify-center z-20 px-[32%] text-center">
        {settings.showChef && (
          <div className="mb-0.5" style={{ color: gold }}><ChefHat size={28} className="mx-auto" /></div>
        )}
        {logoUrl && (
          <div className="rounded-full p-[3px] mb-1" style={{ background: gold }}>
            <img src={logoUrl} alt="" className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-full" crossOrigin="anonymous" />
          </div>
        )}
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
          {settings.slogan}
        </p>
        <div className="mt-2 px-5 py-1.5 rounded-2xl shadow-lg" style={{ background: `linear-gradient(180deg, ${gold}, #c9a227)`, color: navy }}>
          <p className="text-[9px] font-black tracking-widest">TABLE</p>
          <p className="text-2xl sm:text-3xl font-black leading-none" style={{ fontFamily: 'Impact, sans-serif' }}>
            {String(tableNumber).padStart(2, '0')}
          </p>
        </div>
        {settings.showIcons && (
          <div className="mt-2 flex items-center justify-center gap-2 text-[9px] sm:text-[10px] font-semibold" style={{ color: gold }}>
            <span className="flex items-center gap-0.5"><UtensilsCrossed size={12} /> Savourez</span>
            <span className="opacity-40">|</span>
            <span className="flex items-center gap-0.5"><Smile size={12} /> Commandez</span>
            <span className="opacity-40">|</span>
            <span className="flex items-center gap-0.5"><ThumbsUp size={12} /> Profitez</span>
          </div>
        )}
        <p className="text-[9px] mt-1 opacity-70 italic flex items-center gap-1 justify-center">
          <GlassWater size={11} style={{ color: gold }} /> {settings.footerLine}
        </p>
        {settings.brandLine ? (
          <p className="text-[10px] font-bold mt-0.5" style={{ color: gold }}>{settings.brandLine}</p>
        ) : null}
      </div>
    </article>
  );
}

export default function PrintTableQR() {
  const { member, activeEstablishment } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const canEdit = ['super_admin', 'admin', 'owner', 'manager'].includes(
    String(member?.role || ''),
  );

  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState('');
  const [estName, setEstName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [qrCfg, setQrCfg] = useState<QrConfig>({});
  const [placemat, setPlacemat] = useState<PlacematSettings>({ ...DEFAULT_PLACEMAT });
  const [selected, setSelected] = useState<string | 'all'>('all');
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [imgBusy, setImgBusy] = useState<'left' | 'right' | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const estKey = slug || estId || '';
  const cfg = useMemo(() => parseQrConfig(qrCfg), [qrCfg]);
  const themes = useMemo(() => allThemes(placemat), [placemat]);
  const theme = useMemo(() => resolveTheme(placemat), [placemat]);

  const load = useCallback(async () => {
    if (!estId) { setLoading(false); return; }
    setLoading(true);
    const [tRes, eRes] = await Promise.all([
      supabase.from('restaurant_tables').select('id, number, seats, location').eq('establishment_id', estId).order('number'),
      supabase.from('establishments').select('name, slug, logo_url, cover_url, qr_config').eq('id', estId).maybeSingle(),
    ]);
    setTables((tRes.data as TableRow[]) || []);
    const e = eRes.data as Record<string, unknown> | null;
    if (e) {
      setEstName(String(e.name || ''));
      setSlug(String(e.slug || ''));
      setLogoUrl((e.logo_url as string) || (e.cover_url as string) || null);
      const rawCfg = e.qr_config;
      setQrCfg(parseQrConfig(rawCfg));
      const pm = parsePlacemat(rawCfg);
      if (!pm.slogan && (rawCfg as { welcome?: string })?.welcome) {
        pm.slogan = String((rawCfg as { welcome?: string }).welcome);
      }
      setPlacemat(pm);
    }
    setLoading(false);
  }, [estId]);

  useEffect(() => { void load(); }, [load]);

  const visibleTables = useMemo(() => {
    if (selected === 'all') return tables;
    return tables.filter((x) => x.id === selected);
  }, [tables, selected]);

  function cardUrl(tableNumber: string) {
    return orderUrl({ origin, estKey, table: tableNumber, kiosk: cfg.kiosk_default !== false });
  }

  function updateThemeField<K extends keyof PlacematTheme>(key: K, value: PlacematTheme[K]) {
    const t = resolveTheme(placemat);
    const isDefault = DEFAULT_THEMES.some((d) => d.id === t.id);
    if (isDefault) {
      // clone as custom then edit
      const clone: PlacematTheme = { ...t, id: newThemeId(), label: `${t.label} (perso)` };
      clone[key] = value;
      setPlacemat((p) => ({
        ...p,
        activeThemeId: clone.id,
        customThemes: [...p.customThemes.filter((c) => c.id !== clone.id), clone],
      }));
    } else {
      setPlacemat((p) => ({
        ...p,
        customThemes: p.customThemes.map((c) =>
          c.id === t.id ? { ...c, [key]: value } : c,
        ),
      }));
    }
  }

  function addTheme() {
    const base = resolveTheme(placemat);
    const t: PlacematTheme = {
      ...base,
      id: newThemeId(),
      label: `Mon thème ${placemat.customThemes.length + 1}`,
      desc: 'Personnalisé',
    };
    setPlacemat((p) => ({
      ...p,
      activeThemeId: t.id,
      customThemes: [...p.customThemes, t],
    }));
  }

  function deleteTheme(id: string) {
    if (DEFAULT_THEMES.some((d) => d.id === id)) return;
    setPlacemat((p) => {
      const next = p.customThemes.filter((c) => c.id !== id);
      const active = p.activeThemeId === id ? (next[0]?.id || DEFAULT_THEMES[0].id) : p.activeThemeId;
      return { ...p, customThemes: next, activeThemeId: active };
    });
  }

  async function savePlacemat() {
    if (!estId || !canEdit) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const { data: cur } = await supabase
        .from('establishments')
        .select('qr_config')
        .eq('id', estId)
        .maybeSingle();
      const prev = (cur?.qr_config && typeof cur.qr_config === 'object' ? cur.qr_config : {}) as Record<string, unknown>;
      const next = {
        ...prev,
        welcome: placemat.slogan,
        placemat: {
          activeThemeId: placemat.activeThemeId,
          slogan: placemat.slogan,
          footerLine: placemat.footerLine,
          scanLabel: placemat.scanLabel,
          brandLine: placemat.brandLine,
          showFood: placemat.showFood,
          showIcons: placemat.showIcons,
          showChef: placemat.showChef,
          customThemes: placemat.customThemes,
        },
      };
      const { error } = await supabase.from('establishments').update({ qr_config: next }).eq('id', estId);
      if (error) throw error;
      setSaveMsg('Design enregistré');
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : 'Erreur enregistrement');
    } finally {
      setSaving(false);
    }
  }

  async function uploadSide(side: 'left' | 'right', file: File) {
    if (!estId) return;
    setImgBusy(side);
    try {
      const { url } = await uploadVitrineImage(estId, file, 'gallery');
      updateThemeField(side === 'left' ? 'foodLeft' : 'foodRight', url);
    } catch (e) {
      setExportMsg(e instanceof Error ? e.message : 'Upload image échoué');
    } finally {
      setImgBusy(null);
    }
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
          settings: placemat,
          theme,
          qrSrc: qr,
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
    return <div className="flex justify-center py-20 text-stone-400"><Loader2 className="animate-spin" /></div>;
  }
  if (!estId) {
    return <EmptyState icon={<QrCode size={48} />} title="Aucun établissement" message="Sélectionnez un établissement." />;
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
          <p className="text-sm text-stone-400 mt-1">Personnalisez couleurs, images, textes · PNG / PDF</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <button type="button" onClick={() => setEditOpen((v) => !v)} className="btn-secondary flex items-center gap-2 text-sm">
              <Settings2 size={16} /> {editOpen ? 'Fermer l’éditeur' : 'Personnaliser'}
            </button>
          )}
          {canEdit && (
            <button type="button" disabled={saving} onClick={() => void savePlacemat()} className="btn-secondary flex items-center gap-2 text-sm">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Enregistrer
            </button>
          )}
          <button type="button" disabled={exporting || !visibleTables.length} onClick={() => void downloadPngAll()} className="btn-secondary flex items-center gap-2 text-sm">
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} PNG HD
          </button>
          <button type="button" onClick={() => window.print()} className="btn-primary flex items-center gap-2 text-sm">
            <Printer size={16} /> PDF / Imprimer
          </button>
        </div>
      </div>

      {(exportMsg || saveMsg) && (
        <p className="text-sm text-emerald-400 print:hidden">{exportMsg || saveMsg}</p>
      )}

      {/* Sélecteur thèmes */}
      <div className="rounded-2xl border border-stone-800 bg-stone-900/60 p-4 space-y-3 print:hidden">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-stone-400 uppercase">Thèmes</p>
          {canEdit && (
            <button type="button" onClick={addTheme} className="text-xs text-amber-400 flex items-center gap-1">
              <Plus size={14} /> Ajouter un thème
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {themes.map((x) => {
            const isCustom = !DEFAULT_THEMES.some((d) => d.id === x.id);
            return (
              <div
                key={x.id}
                className={`rounded-xl border p-2 text-left relative ${
                  placemat.activeThemeId === x.id ? 'border-amber-500 bg-amber-500/15' : 'border-stone-800 bg-stone-950'
                }`}
              >
                <button type="button" className="w-full text-left" onClick={() => setPlacemat((p) => ({ ...p, activeThemeId: x.id }))}>
                  <div className="flex gap-0.5 h-10 rounded-lg overflow-hidden mb-1.5">
                    <img src={x.foodLeft} alt="" className="w-1/2 object-cover" />
                    <img src={x.foodRight} alt="" className="w-1/2 object-cover" />
                  </div>
                  <p className="text-sm font-semibold text-stone-100 truncate">{x.label}</p>
                </button>
                {isCustom && canEdit && (
                  <button
                    type="button"
                    className="absolute top-1 right-1 p-1 rounded bg-black/50 text-red-400"
                    onClick={() => deleteTheme(x.id)}
                    title="Supprimer"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div>
          <p className="text-xs font-semibold text-stone-400 uppercase mb-2">Tables</p>
          <select className="input w-full" value={selected} onChange={(e) => setSelected(e.target.value === 'all' ? 'all' : e.target.value)}>
            <option value="all">Toutes ({tables.length})</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>Table {t.number}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Éditeur */}
      {editOpen && canEdit && (
        <div className="rounded-2xl border border-amber-500/40 bg-stone-900 p-4 space-y-4 print:hidden">
          <h2 className="text-sm font-bold text-amber-400 flex items-center gap-2">
            <Settings2 size={16} /> Éditeur — {theme.label}
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {([
              ['navy', 'Fond / coins'],
              ['gold', 'Or / accents'],
              ['cream', 'Fond centre'],
              ['ink', 'Texte'],
            ] as const).map(([key, lab]) => (
              <label key={key} className="text-xs text-stone-400">
                {lab}
                <input
                  type="color"
                  className="mt-1 w-full h-10 rounded cursor-pointer bg-transparent"
                  value={theme[key]}
                  onChange={(e) => updateThemeField(key, e.target.value)}
                />
              </label>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm text-stone-300">
            <input
              type="checkbox"
              checked={theme.dark}
              onChange={(e) => updateThemeField('dark', e.target.checked)}
            />
            Mode sombre (dégradé)
          </label>

          <div>
            <label className="text-xs text-stone-400">Nom du thème</label>
            <input
              className="input w-full mt-1"
              value={theme.label}
              onChange={(e) => updateThemeField('label', e.target.value)}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-stone-400 mb-1">Image gauche (plat / boisson)</p>
              <div className="flex gap-2 items-center">
                <img src={theme.foodLeft} alt="" className="w-16 h-16 rounded-lg object-cover" />
                <label className="btn-secondary text-xs cursor-pointer">
                  {imgBusy === 'left' ? '…' : 'Galerie'}
                  <input type="file" accept="image/*" className="hidden" disabled={!!imgBusy}
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadSide('left', f); }} />
                </label>
              </div>
              <input
                className="input w-full mt-1 text-xs"
                placeholder="Ou coller une URL image"
                value={theme.foodLeft}
                onChange={(e) => updateThemeField('foodLeft', e.target.value)}
              />
            </div>
            <div>
              <p className="text-xs text-stone-400 mb-1">Image droite</p>
              <div className="flex gap-2 items-center">
                <img src={theme.foodRight} alt="" className="w-16 h-16 rounded-lg object-cover" />
                <label className="btn-secondary text-xs cursor-pointer">
                  {imgBusy === 'right' ? '…' : 'Galerie'}
                  <input type="file" accept="image/*" className="hidden" disabled={!!imgBusy}
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadSide('right', f); }} />
                </label>
              </div>
              <input
                className="input w-full mt-1 text-xs"
                placeholder="Ou coller une URL image"
                value={theme.foodRight}
                onChange={(e) => updateThemeField('foodRight', e.target.value)}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-stone-400">Slogan</label>
              <input className="input w-full mt-1" value={placemat.slogan}
                onChange={(e) => setPlacemat((p) => ({ ...p, slogan: e.target.value }))} maxLength={80} />
            </div>
            <div>
              <label className="text-xs text-stone-400">Texte bas (footer)</label>
              <input className="input w-full mt-1" value={placemat.footerLine}
                onChange={(e) => setPlacemat((p) => ({ ...p, footerLine: e.target.value }))} maxLength={80} />
            </div>
            <div>
              <label className="text-xs text-stone-400">Libellé sous QR</label>
              <input className="input w-full mt-1" value={placemat.scanLabel}
                onChange={(e) => setPlacemat((p) => ({ ...p, scanLabel: e.target.value }))} maxLength={24} />
            </div>
            <div>
              <label className="text-xs text-stone-400">Ligne marque (optionnel)</label>
              <input className="input w-full mt-1" value={placemat.brandLine}
                onChange={(e) => setPlacemat((p) => ({ ...p, brandLine: e.target.value }))} maxLength={40}
                placeholder={estName} />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-stone-300">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={placemat.showFood}
                onChange={(e) => setPlacemat((p) => ({ ...p, showFood: e.target.checked }))} />
              Photos plats / boissons
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={placemat.showIcons}
                onChange={(e) => setPlacemat((p) => ({ ...p, showIcons: e.target.checked }))} />
              Icônes Savourez / Commandez
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={placemat.showChef}
                onChange={(e) => setPlacemat((p) => ({ ...p, showChef: e.target.checked }))} />
              Icône chef
            </label>
          </div>

          <p className="text-[11px] text-stone-500">
            Modifier un thème par défaut crée automatiquement une copie « perso ». Pensez à <strong>Enregistrer</strong> puis exporter PNG / PDF.
          </p>
        </div>
      )}

      {tables.length === 0 ? (
        <EmptyState icon={<LayoutGrid size={48} />} title="Aucune table" message="Créez des tables puis imprimez." />
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
                  settings={placemat}
                  theme={theme}
                />
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 5mm; }
          html, body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body * { visibility: hidden !important; }
          #qr-print-area, #qr-print-area * { visibility: visible !important; }
          #qr-print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; display: block !important; }
          #qr-print-area .qr-nappe {
            break-after: page; page-break-after: always;
            width: 100% !important; height: 188mm !important; max-height: 188mm !important;
            aspect-ratio: auto !important;
            -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
          }
          #qr-print-area .qr-nappe:last-child { break-after: auto; page-break-after: auto; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
