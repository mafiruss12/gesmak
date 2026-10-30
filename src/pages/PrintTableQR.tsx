import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  QrCode, Printer, Download, Loader2, ArrowLeft, Sparkles, LayoutGrid,
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

type TemplateId = 'affiche' | 'maquis' | 'elegant' | 'minimal' | 'festif';
type Density = '1' | '4';

const TEMPLATES: {
  id: TemplateId;
  label: string;
  desc: string;
  frame: string;
  accent: string;
  bg: string;
  text: string;
}[] = [
  {
    id: 'affiche',
    label: 'Affiche pro',
    desc: 'Orange GESMAK · A4',
    frame: 'from-orange-600 via-amber-500 to-orange-700',
    accent: '#FF7900',
    bg: '#fff7ed',
    text: '#7c2d12',
  },
  {
    id: 'maquis',
    label: 'Maquis ambre',
    desc: 'Orange / crème',
    frame: 'from-amber-600 via-orange-500 to-amber-700',
    accent: '#f59e0b',
    bg: '#fffbeb',
    text: '#1c1917',
  },
  {
    id: 'elegant',
    label: 'Resto élégant',
    desc: 'Sombre & doré',
    frame: 'from-stone-900 via-stone-800 to-amber-900',
    accent: '#eab308',
    bg: '#1c1917',
    text: '#fafaf9',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    desc: 'Blanc, simple',
    frame: 'from-stone-200 via-white to-stone-100',
    accent: '#292524',
    bg: '#ffffff',
    text: '#1c1917',
  },
  {
    id: 'festif',
    label: 'Festif',
    desc: 'Couleurs vives',
    frame: 'from-fuchsia-600 via-orange-500 to-yellow-400',
    accent: '#db2777',
    bg: '#fdf4ff',
    text: '#1c1917',
  },
];

const SM_ORANGE = '#FF7900';
const SM_ORANGE_DARK = '#c2410c';

export default function PrintTableQR() {
  const { member, activeEstablishment } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState('');
  const [estName, setEstName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [qrCfg, setQrCfg] = useState<QrConfig>({});
  const [template, setTemplate] = useState<TemplateId>('affiche');
  const [density, setDensity] = useState<Density>('4');
  const [selected, setSelected] = useState<string | 'all'>('all');
  const [phrase, setPhrase] = useState('Scannez pour commander votre boisson');
  const [busy, setBusy] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const estKey = slug || estId || '';
  const tpl = TEMPLATES.find((x) => x.id === template) || TEMPLATES[0];
  const cfg = useMemo(() => parseQrConfig(qrCfg), [qrCfg]);

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
      // Ne pas écraser avec un titre technique type "A1"
      const title = String((e.qr_config as { title?: string })?.title || '').trim();
      if (title && title.length > 2 && !/^[A-Z]?\d+$/i.test(title)) {
        setPhrase(title);
      }
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

  function handlePrint() {
    window.print();
  }

  async function downloadPng(tableNumber: string) {
    setBusy(true);
    try {
      const url = cardUrl(tableNumber);
      const qr = qrImageUrl(url, cfg, 400);
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 800;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#fff7ed';
      ctx.fillRect(0, 0, 600, 800);
      ctx.fillStyle = SM_ORANGE;
      ctx.fillRect(0, 0, 600, 120);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText((estName || 'GESMAK').slice(0, 28), 300, 50);
      ctx.font = '14px sans-serif';
      ctx.fillText('COMMANDE À TABLE', 300, 85);
      ctx.fillStyle = '#7c2d12';
      ctx.font = 'bold 56px sans-serif';
      ctx.fillText(`Table ${tableNumber}`, 300, 200);
      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = SM_ORANGE_DARK;
      ctx.fillText(phrase.slice(0, 40), 300, 250);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('QR'));
        img.src = qr;
      });
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(100, 280, 400, 400);
      ctx.drawImage(img, 120, 300, 360, 360);
      ctx.fillStyle = SM_ORANGE;
      ctx.fillRect(100, 700, 400, 48);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('SCANNEZ CE QR CODE', 300, 730);
      const a = document.createElement('a');
      a.download = `qr-table-${tableNumber}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    } catch {
      /* ignore */
    }
    setBusy(false);
  }

  async function downloadAllPng() {
    for (const tb of visibleTables) {
      await downloadPng(tb.number);
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

  const isAffiche = template === 'affiche';
  const qrSize = density === '4' ? 180 : 280;

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-16">
      <div className="flex items-start justify-between gap-3 print:hidden">
        <div>
          <Link to="/tables" className="text-xs text-amber-400 hover:underline flex items-center gap-1 mb-1">
            <ArrowLeft size={12} /> Tables
          </Link>
          <h1 className="text-2xl font-bold text-stone-100 flex items-center gap-2">
            <Printer className="text-amber-400" /> Imprimer QR tables
          </h1>
          <p className="text-sm text-stone-400 mt-1">
            Affiche pro orange · 1 ou 4 QR par page A4
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-stone-800 bg-stone-900/60 p-4 space-y-3 print:hidden">
        <p className="text-xs font-semibold text-stone-400 uppercase">Modèle</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {TEMPLATES.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setTemplate(x.id)}
              className={`rounded-xl border p-3 text-left ${
                template === x.id
                  ? 'border-amber-500 bg-amber-500/15'
                  : 'border-stone-800 bg-stone-950'
              }`}
            >
              <div className={`h-2 rounded-full bg-gradient-to-r ${x.frame} mb-2`} />
              <p className="text-sm font-semibold text-stone-100">{x.label}</p>
              <p className="text-[10px] text-stone-500">{x.desc}</p>
            </button>
          ))}
        </div>

        <div>
          <p className="text-xs font-semibold text-stone-400 uppercase mb-2">Par page A4</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDensity('1')}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${
                density === '1'
                  ? 'border-amber-500 bg-amber-500/15 text-amber-200'
                  : 'border-stone-700 text-stone-400'
              }`}
            >
              1 QR (grande affiche)
            </button>
            <button
              type="button"
              onClick={() => setDensity('4')}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${
                density === '4'
                  ? 'border-amber-500 bg-amber-500/15 text-amber-200'
                  : 'border-stone-700 text-stone-400'
              }`}
            >
              4 QR (grille A4)
            </button>
          </div>
        </div>

        <label className="block text-xs text-stone-400">
          Phrase sous le QR (grand texte)
          <input
            className="input-field mt-1"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            maxLength={60}
            placeholder="Scannez pour commander votre boisson"
          />
        </label>

        <label className="block text-xs text-stone-400">
          Tables à imprimer
          <select
            className="input-field mt-1"
            value={selected}
            onChange={(e) => setSelected(e.target.value === 'all' ? 'all' : e.target.value)}
          >
            <option value="all">Toutes les tables ({tables.length})</option>
            {tables.map((tb) => (
              <option key={tb.id} value={tb.id}>
                Table {tb.number}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary flex items-center gap-2" onClick={handlePrint}>
            <Printer size={16} /> Imprimer / PDF
          </button>
          <button
            type="button"
            className="btn-secondary flex items-center gap-2"
            disabled={busy || !visibleTables.length}
            onClick={() => void downloadAllPng()}
          >
            {busy ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
            PNG
          </button>
          <Link to="/menu-qr" className="btn-secondary text-sm flex items-center gap-1">
            <Sparkles size={14} /> Réglages QR Code
          </Link>
        </div>
        <p className="text-[11px] text-stone-500">
          Conseil : mode <strong>4 QR</strong> pour découper 4 tables sur une feuille A4.
        </p>
      </div>

      {tables.length === 0 ? (
        <EmptyState
          icon={<LayoutGrid size={48} />}
          title="Aucune table"
          message="Créez des tables d’abord, puis revenez imprimer les QR."
        />
      ) : (
        <div
          ref={printRef}
          id="qr-print-area"
          data-density={density}
          data-template={template}
          className={
            density === '4'
              ? 'grid grid-cols-2 gap-3 print:gap-0'
              : 'grid grid-cols-1 max-w-lg mx-auto gap-4'
          }
        >
          {visibleTables.map((tb) => {
            const url = cardUrl(tb.number);
            const qr = qrImageUrl(url, cfg, qrSize);
            const compact = density === '4';

            if (isAffiche) {
              return (
                <article
                  key={tb.id}
                  className="qr-print-card overflow-hidden border border-orange-300 print:border-orange-400 print:break-inside-avoid"
                  style={{
                    background: '#fff7ed',
                    color: '#7c2d12',
                  }}
                >
                  {/* Bandeau — couleurs en style inline pour l’impression */}
                  <div
                    style={{ background: SM_ORANGE, color: '#fff' }}
                    className={`text-center ${compact ? 'px-2 py-2' : 'px-4 py-3'}`}
                  >
                    <p
                      className={`font-bold uppercase tracking-widest opacity-90 ${
                        compact ? 'text-[8px]' : 'text-[10px]'
                      }`}
                    >
                      Commande à table
                    </p>
                    <p className={`font-black leading-tight ${compact ? 'text-sm' : 'text-lg'}`}>
                      {(estName || 'GESMAK').slice(0, compact ? 22 : 32)}
                    </p>
                  </div>

                  <div className={`flex flex-col items-center text-center ${compact ? 'p-2' : 'p-4'}`}>
                    {logoUrl && !compact && (
                      <img
                        src={logoUrl}
                        alt=""
                        className="w-12 h-12 rounded-full object-cover border-2 border-orange-300 mb-1"
                      />
                    )}
                    <p
                      className={`font-black tracking-tight ${
                        compact ? 'text-xl' : 'text-3xl'
                      }`}
                      style={{ color: SM_ORANGE_DARK }}
                    >
                      Table {tb.number}
                    </p>
                    <p
                      className={`font-bold leading-snug mt-1 ${
                        compact ? 'text-[11px] px-1' : 'text-base sm:text-lg max-w-[280px]'
                      }`}
                      style={{ color: '#9a3412' }}
                    >
                      {phrase || 'Scannez pour commander votre boisson'}
                    </p>

                    <div
                      className={`mt-2 rounded-xl bg-white border border-orange-200 shadow-sm ${
                        compact ? 'p-1.5' : 'p-3'
                      }`}
                    >
                      <img
                        src={qr}
                        alt={`QR table ${tb.number}`}
                        width={qrSize}
                        height={qrSize}
                        className={compact ? 'w-[38mm] h-[38mm] max-w-full' : 'w-56 h-56 print:w-[70mm] print:h-[70mm]'}
                        style={{ imageRendering: 'pixelated' }}
                      />
                    </div>

                    <div
                      className={`mt-2 w-full font-bold text-white flex items-center justify-center gap-1 ${
                        compact ? 'text-[9px] py-1.5 rounded-lg' : 'text-xs py-2.5 rounded-xl'
                      }`}
                      style={{ background: SM_ORANGE }}
                    >
                      <QrCode size={compact ? 10 : 14} />
                      SCANNEZ CE QR CODE
                    </div>
                    <p className={`mt-1 opacity-70 ${compact ? 'text-[8px]' : 'text-[10px]'}`}>
                      sans télécharger d&apos;application
                    </p>

                    <div
                      className={`w-full grid grid-cols-3 gap-1 mt-2 ${compact ? 'text-[7px]' : 'text-[9px]'}`}
                    >
                      {['Menu', 'Commande', 'Service'].map((lab) => (
                        <span
                          key={lab}
                          className="rounded-md border border-orange-200 bg-white py-0.5 font-semibold"
                        >
                          {lab}
                        </span>
                      ))}
                    </div>

                    <p
                      className={`mt-2 font-semibold ${compact ? 'text-[8px]' : 'text-[11px]'}`}
                      style={{ color: SM_ORANGE_DARK }}
                    >
                      On est ensemble chez {(estName || 'nous').slice(0, compact ? 18 : 28)} !
                    </p>
                  </div>

                  <button
                    type="button"
                    className="print:hidden text-xs py-1.5 w-full underline opacity-60"
                    onClick={() => void downloadPng(tb.number)}
                  >
                    PNG
                  </button>
                </article>
              );
            }

            /* Autres modèles — carte simple */
            return (
              <article
                key={tb.id}
                className="qr-print-card rounded-2xl border border-stone-700 overflow-hidden print:break-inside-avoid"
                style={{ background: tpl.bg, color: tpl.text }}
              >
                <div className={`h-2 bg-gradient-to-r ${tpl.frame}`} />
                <div className={`flex flex-col items-center text-center ${compact ? 'p-3' : 'p-5'} gap-1`}>
                  <p className="text-xs font-semibold opacity-70">{estName}</p>
                  <p className="text-2xl font-black" style={{ color: tpl.accent }}>
                    Table {tb.number}
                  </p>
                  <p className="text-sm font-bold max-w-[220px]">{phrase}</p>
                  <div className="bg-white p-2 rounded-xl my-1">
                    <img src={qr} alt="" className={compact ? 'w-32 h-32' : 'w-48 h-48'} />
                  </div>
                  <p className="text-[10px] opacity-50 flex items-center gap-1">
                    <QrCode size={12} /> Scannez pour commander
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <style>{`
        @media print {
          @page { size: A4; margin: 8mm; }
          body * { visibility: hidden !important; }
          #qr-print-area, #qr-print-area * { visibility: visible !important; }
          #qr-print-area {
            position: absolute;
            left: 0; top: 0;
            width: 100%;
            padding: 0 !important;
          }
          #qr-print-area[data-density="4"] {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            grid-auto-rows: auto;
            gap: 4mm !important;
          }
          #qr-print-area[data-density="4"] .qr-print-card {
            break-inside: avoid;
            page-break-inside: avoid;
            height: 128mm;
            max-height: 128mm;
            overflow: hidden;
          }
          #qr-print-area[data-density="1"] {
            display: grid !important;
            grid-template-columns: 1fr !important;
          }
          #qr-print-area[data-density="1"] .qr-print-card {
            break-after: page;
            page-break-after: always;
            min-height: 270mm;
          }
          #qr-print-area[data-density="1"] .qr-print-card:last-child {
            break-after: auto;
            page-break-after: auto;
          }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
