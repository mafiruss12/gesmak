import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  QrCode, Printer, Loader2, ArrowLeft, LayoutGrid,
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

type TemplateId = 'nappe' | 'nappe_sombre' | 'affiche' | 'maquis' | 'minimal';
type Density = '1' | '4';

const TEMPLATES: {
  id: TemplateId;
  label: string;
  desc: string;
}[] = [
  { id: 'nappe', label: 'Nappe de table', desc: '4 QR · logo centre · impression pro' },
  { id: 'nappe_sombre', label: 'Nappe marine', desc: 'Bleu nuit & or (style resto)' },
  { id: 'affiche', label: 'Affiche 1 QR', desc: 'Un grand QR au centre' },
  { id: 'maquis', label: 'Maquis ambre', desc: 'Orange / crème' },
  { id: 'minimal', label: 'Minimal', desc: 'Blanc simple' },
];

/** Carte nappe : 4 QR aux coins + logo + nom + n° table (prête à plastifier). */
function PlacematCard({
  estName,
  logoUrl,
  tableNumber,
  qrSrc,
  phrase,
  dark,
}: {
  estName: string;
  logoUrl: string | null;
  tableNumber: string;
  qrSrc: string;
  phrase: string;
  dark?: boolean;
}) {
  const navy = dark ? '#0a1628' : '#0b1f4a';
  const gold = '#f5c518';
  const cream = dark ? '#0f172a' : '#f8fafc';
  const ink = dark ? '#f8fafc' : '#0b1f4a';

  const Corner = ({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) => {
    const posCls =
      pos === 'tl'
        ? 'top-0 left-0 rounded-br-[2.5rem]'
        : pos === 'tr'
          ? 'top-0 right-0 rounded-bl-[2.5rem]'
          : pos === 'bl'
            ? 'bottom-0 left-0 rounded-tr-[2.5rem]'
            : 'bottom-0 right-0 rounded-tl-[2.5rem]';
    return (
      <div
        className={`absolute ${posCls} w-[28%] max-w-[140px] aspect-square flex flex-col items-center justify-center p-2 z-10`}
        style={{
          background: `linear-gradient(145deg, ${navy}, #1e3a8a)`,
          boxShadow: 'inset 0 0 0 3px ' + gold,
        }}
      >
        <div className="bg-white rounded-lg p-1 shadow-md w-[85%] aspect-square flex items-center justify-center">
          <img src={qrSrc} alt="" className="w-full h-full object-contain" />
        </div>
        <p className="text-[8px] sm:text-[9px] font-semibold mt-1 flex items-center gap-0.5" style={{ color: gold }}>
          <span className="inline-block w-2 h-2 rounded-sm border border-current" /> Scannez ici
        </p>
      </div>
    );
  };

  return (
    <article
      className="qr-print-card qr-nappe relative overflow-hidden print:break-inside-avoid"
      style={{
        background: cream,
        color: ink,
        aspectRatio: '1.4 / 1',
        minHeight: 280,
        borderRadius: 20,
        border: `3px solid ${navy}`,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      }}
    >
      {/* Bandes décoratives */}
      <div
        className="absolute top-0 left-[22%] right-[22%] h-10 rounded-b-3xl z-[1]"
        style={{ background: `linear-gradient(90deg, ${navy}, #1d4ed8, ${navy})` }}
      />
      <div
        className="absolute bottom-0 left-[18%] right-[18%] h-12 rounded-t-3xl z-[1]"
        style={{ background: `linear-gradient(90deg, ${navy}, #1e40af, ${navy})` }}
      />
      <div
        className="absolute left-0 top-[20%] bottom-[20%] w-3 z-[1]"
        style={{ background: `linear-gradient(${gold}, ${navy}, ${gold})` }}
      />
      <div
        className="absolute right-0 top-[20%] bottom-[20%] w-3 z-[1]"
        style={{ background: `linear-gradient(${gold}, ${navy}, ${gold})` }}
      />

      <Corner pos="tl" />
      <Corner pos="tr" />
      <Corner pos="bl" />
      <Corner pos="br" />

      {/* Centre */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-[5] px-16 sm:px-20 text-center pointer-events-none">
        <p
          className="text-[11px] sm:text-xs font-bold tracking-wide mb-1"
          style={{ color: gold, textShadow: dark ? 'none' : '0 1px 0 #fff' }}
        >
          Scannez pour commander votre menu !
        </p>

        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-full bg-white border-2 shadow-md mb-1"
            style={{ borderColor: gold }}
            crossOrigin="anonymous"
          />
        ) : (
          <div
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mb-1 border-2"
            style={{ background: navy, borderColor: gold, color: gold }}
          >
            <QrCode size={28} />
          </div>
        )}

        <h2
          className="text-xl sm:text-2xl md:text-3xl font-black leading-tight max-w-[70%]"
          style={{ color: ink, fontFamily: 'Georgia, serif' }}
        >
          {estName || 'Mon établissement'}
        </h2>
        <p className="text-[10px] sm:text-xs italic opacity-80 mt-0.5 max-w-[65%]">
          {phrase || 'Bon goût, bonne ambiance !'}
        </p>

        <div className="mt-2 flex flex-col items-center">
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-t-lg"
            style={{ background: navy, color: '#fff' }}
          >
            Table N°
          </span>
          <span
            className="text-2xl sm:text-3xl font-black px-5 py-1 rounded-b-xl min-w-[4.5rem]"
            style={{ background: gold, color: navy }}
          >
            {/^\d+$/.test(String(tableNumber)) ? `T${tableNumber}` : tableNumber}
          </span>
        </div>

        <div className="flex gap-4 mt-3 text-[9px] sm:text-[10px] opacity-70">
          <span>Cuisine</span>
          <span>·</span>
          <span>Boissons</span>
          <span>·</span>
          <span>Service</span>
        </div>
      </div>

      {/* Texte bas bande */}
      <p
        className="absolute bottom-2 left-0 right-0 text-center text-[9px] font-medium z-20"
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
  const [template, setTemplate] = useState<TemplateId>('nappe');
  const [density, setDensity] = useState<Density>('1');
  const [selected, setSelected] = useState<string | 'all'>('all');
  const [phrase, setPhrase] = useState('Bon goût, bonne ambiance !');

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const estKey = slug || estId || '';
  const cfg = useMemo(() => parseQrConfig(qrCfg), [qrCfg]);
  const isNappe = template === 'nappe' || template === 'nappe_sombre';

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
      const title = String((e.qr_config as { title?: string; welcome?: string })?.welcome || '').trim();
      if (title && title.length > 2) setPhrase(title);
    }
    setLoading(false);
  }, [estId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (isNappe) setDensity('1');
  }, [isNappe]);

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
      <div className="flex items-start justify-between gap-3 print:hidden">
        <div>
          <Link to="/tables" className="text-xs text-amber-400 hover:underline flex items-center gap-1 mb-1">
            <ArrowLeft size={12} /> Tables
          </Link>
          <h1 className="text-2xl font-bold text-stone-100 flex items-center gap-2">
            <Printer className="text-amber-400" /> Nappes QR tables
          </h1>
          <p className="text-sm text-stone-400 mt-1">
            Design nappe · 4 QR aux coins · logo établissement · prêt à imprimer / plastifier
          </p>
        </div>
        <button type="button" onClick={() => window.print()} className="btn-primary flex items-center gap-2">
          <Printer size={16} /> Imprimer
        </button>
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
                template === x.id ? 'border-amber-500 bg-amber-500/15' : 'border-stone-800 bg-stone-950'
              }`}
            >
              <p className="text-sm font-semibold text-stone-100">{x.label}</p>
              <p className="text-[10px] text-stone-500">{x.desc}</p>
            </button>
          ))}
        </div>

        {!isNappe && (
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase mb-2">Par page A4</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDensity('1')}
                className={`px-3 py-2 rounded-lg text-sm ${density === '1' ? 'bg-amber-500 text-stone-900' : 'bg-stone-800 text-stone-300'}`}
              >
                1 par page
              </button>
              <button
                type="button"
                onClick={() => setDensity('4')}
                className={`px-3 py-2 rounded-lg text-sm ${density === '4' ? 'bg-amber-500 text-stone-900' : 'bg-stone-800 text-stone-300'}`}
              >
                4 par page
              </button>
            </div>
          </div>
        )}

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

        {!logoUrl && (
          <p className="text-xs text-amber-400/90">
            Astuce : ajoutez le logo de l’établissement dans les paramètres pour qu’il apparaisse au centre de la nappe.
          </p>
        )}
      </div>

      {tables.length === 0 ? (
        <EmptyState
          icon={<LayoutGrid size={48} />}
          title="Aucune table"
          message="Créez des tables (ex. T1, T12) puis revenez imprimer les nappes."
        />
      ) : (
        <div
          id="qr-print-area"
          data-density={isNappe ? '1' : density}
          data-nappe={isNappe ? '1' : '0'}
          className={`gap-4 ${isNappe || density === '1' ? 'grid grid-cols-1' : 'grid grid-cols-1 sm:grid-cols-2'}`}
        >
          {visibleTables.map((tb) => {
            const url = cardUrl(tb.number);
            const qr = qrImageUrl(url, { ...cfg, color: '0b1f4a', bg: 'ffffff' }, 220);

            if (isNappe) {
              return (
                <PlacematCard
                  key={tb.id}
                  estName={estName}
                  logoUrl={logoUrl}
                  tableNumber={tb.number}
                  qrSrc={qr}
                  phrase={phrase}
                  dark={template === 'nappe_sombre'}
                />
              );
            }

            const accent =
              template === 'affiche' ? '#FF7900' : template === 'maquis' ? '#f59e0b' : '#292524';
            const bg =
              template === 'affiche' ? '#fff7ed' : template === 'maquis' ? '#fffbeb' : '#ffffff';

            return (
              <article
                key={tb.id}
                className="qr-print-card rounded-2xl border border-stone-300 overflow-hidden bg-white print:break-inside-avoid"
                style={{ background: bg }}
              >
                <div className="p-5 flex flex-col items-center text-center gap-2">
                  {logoUrl && (
                    <img src={logoUrl} alt="" className="w-14 h-14 object-contain rounded-full" />
                  )}
                  <p className="text-sm font-semibold text-stone-700">{estName}</p>
                  <p className="text-3xl font-black" style={{ color: accent }}>
                    Table {tb.number}
                  </p>
                  <p className="text-sm font-bold text-stone-600">{phrase}</p>
                  <div className="bg-white p-2 rounded-xl border">
                    <img src={qr} alt="" className="w-48 h-48" />
                  </div>
                  <p className="text-[10px] text-stone-400">Scannez pour commander</p>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 6mm;
          }
          body * { visibility: hidden !important; }
          #qr-print-area, #qr-print-area * { visibility: visible !important; }
          #qr-print-area {
            position: absolute;
            left: 0; top: 0;
            width: 100%;
            padding: 0 !important;
            display: block !important;
          }
          #qr-print-area[data-nappe="1"] .qr-nappe {
            break-after: page;
            page-break-after: always;
            width: 100% !important;
            height: 190mm !important;
            max-height: 190mm !important;
            aspect-ratio: auto !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          #qr-print-area[data-nappe="1"] .qr-nappe:last-child {
            break-after: auto;
            page-break-after: auto;
          }
          #qr-print-area[data-density="4"] {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 4mm !important;
          }
          #qr-print-area[data-density="4"] .qr-print-card {
            break-inside: avoid;
            height: 90mm;
          }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
