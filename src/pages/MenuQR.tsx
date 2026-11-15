import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  QrCode, Copy, Check, ExternalLink, Printer, Loader2, ToggleLeft, ToggleRight,
  ArrowLeft, Plus, LayoutGrid,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { usePlanAccess } from '@/lib/usePlanAccess';
import { useAuth } from '@/lib/auth';
import {
  normalizeBusinessType,
  BUSINESS_THEMES,
} from '@/lib/businessTypes';
import { EmptyState } from '@/components/ui';
import {
  parseQrConfig,
  qrImageUrl,
  orderUrl,
  type QrConfig,
} from '@/lib/qrBranding';

type TableRow = { id: string; number: string };

/**
 * QR Code — config + génération (tables) + lien impression.
 */
export default function MenuQR() {
  const { member, activeEstablishment, effectiveRole } = useAuth();
  const { allow, plan } = usePlanAccess();
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const bizType = normalizeBusinessType(activeEstablishment?.type);
  const theme = BUSINESS_THEMES[bizType];
  const canEdit = ['super_admin', 'admin', 'owner', 'manager'].includes(
    String(effectiveRole || member?.role || ''),
  );

  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [qrColor, setQrColor] = useState('1c1917');
  const [qrBg, setQrBg] = useState('ffffff');
  const [qrTitle, setQrTitle] = useState('');
  const [qrWelcome, setQrWelcome] = useState('Scannez pour commander votre boisson');
  const [qrKiosk, setQrKiosk] = useState(true);
  const [slug, setSlug] = useState('');
  const [showStock, setShowStock] = useState(true);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [newTableNum, setNewTableNum] = useState('');
  const [addingTable, setAddingTable] = useState(false);

  const estKey = slug || estId || '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const qrCfgLive: QrConfig = {
    color: qrColor,
    bg: qrBg,
    title: qrTitle,
    welcome: qrWelcome,
    kiosk_default: qrKiosk,
  };
  const sampleTableUrl =
    estKey && origin
      ? orderUrl({ origin, estKey, table: tables[0]?.number || '1', kiosk: qrKiosk })
      : '';
  const sampleTableQr = sampleTableUrl ? qrImageUrl(sampleTableUrl, qrCfgLive, 240) : '';

  const load = useCallback(async () => {
    if (!estId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const [estRes, tabRes] = await Promise.all([
      supabase
        .from('establishments')
        .select('name, slug, qr_config, public_show_stock, public_menu')
        .eq('id', estId)
        .maybeSingle(),
      supabase
        .from('restaurant_tables')
        .select('id, number')
        .eq('establishment_id', estId)
        .order('number'),
    ]);
    if (estRes.error) {
      setError(estRes.error.message);
      setLoading(false);
      return;
    }
    const row = estRes.data as Record<string, unknown> | null;
    if (row) {
      setSlug(String(row.slug || ''));
      setShowStock(row.public_show_stock !== false);
      setEnabled(row.public_menu !== false);
      const cfg = parseQrConfig(row.qr_config);
      setQrColor(cfg.color);
      setQrBg(cfg.bg);
      setQrTitle(cfg.title);
      if (cfg.welcome && !/^[A-Z]?\d+$/i.test(cfg.welcome.trim())) {
        setQrWelcome(cfg.welcome);
      }
      setQrKiosk(cfg.kiosk_default);
    }
    setTables((tabRes.data as TableRow[]) || []);
    setLoading(false);
  }, [estId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleEnabled() {
    if (!estId || !canEdit) return;
    const next = !enabled;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from('establishments')
      .update({ public_menu: next })
      .eq('id', estId);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setEnabled(next);
    setOkMsg(next ? 'Commande QR activée' : 'Commande QR désactivée');
    setTimeout(() => setOkMsg(null), 2500);
  }

  async function saveQrConfig() {
    if (!estId || !canEdit) return;
    setSaving(true);
    setError(null);
    try {
      const { slugify } = await import('@/lib/publicEstablishment');
      const finalSlug =
        (slug || '').trim() ||
        slugify(String(activeEstablishment?.name || 'etablissement'), estId);
      const { error: err } = await supabase
        .from('establishments')
        .update({
          slug: finalSlug,
          public_show_stock: showStock,
          qr_config: {
            color: qrColor,
            bg: qrBg,
            title: qrTitle,
            welcome: qrWelcome,
            kiosk_default: qrKiosk,
            show_name: true,
          },
        })
        .eq('id', estId);
      setSaving(false);
      if (err) {
        setError(err.message);
        return;
      }
      setSlug(finalSlug);
      setOkMsg('QR Code enregistré');
      setTimeout(() => setOkMsg(null), 2500);
    } catch (e: unknown) {
      setSaving(false);
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function addTable() {
    if (!estId || !canEdit) return;
    const num = newTableNum.trim() || `T${tables.length + 1}`;
    setAddingTable(true);
    setError(null);
    const { error: err } = await supabase.from('restaurant_tables').insert({
      establishment_id: estId,
      number: num,
      seats: 4,
      status: 'free',
    });
    setAddingTable(false);
    if (err) {
      setError(err.message);
      return;
    }
    setNewTableNum('');
    setOkMsg(`Table ${num} créée — vous pouvez imprimer son QR`);
    setTimeout(() => setOkMsg(null), 3000);
    void load();
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copie impossible');
    }
  }

  if (!estId) {
    return (
      <EmptyState
        icon={<QrCode size={48} />}
        title="Aucun établissement"
        message="Sélectionnez un établissement pour configurer les QR tables."
      />
    );
  }

  if (!allow('qrOrdering')) {
    return (
      <div className="card p-6 space-y-3 max-w-lg mx-auto">
        <h1 className="text-lg font-semibold text-stone-100">QR Code</h1>
        <p className="text-sm text-stone-400">
          Réservé au plan <strong className="text-amber-300">Pro</strong> (plan
          effectif : {plan.label}).
        </p>
        <Link to="/subscription" className="btn-primary inline-flex justify-center">
          Voir les forfaits
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto pb-16">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 mb-4"
      >
        <ArrowLeft size={16} /> Accueil
      </Link>

      <div className="mb-5">
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: theme.primary }}>
          Tables & commandes
        </p>
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mt-0.5 flex items-center gap-2">
          <QrCode size={22} style={{ color: theme.primary }} />
          QR Code
        </h1>
        <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
          Créez des tables, générez les QR et imprimez-les pour la salle.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          {error}
        </div>
      )}
      {okMsg && (
        <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
          {okMsg}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12 text-stone-400">
          <Loader2 className="animate-spin" size={20} />
        </div>
      ) : (
        <div className="space-y-4">
          {/* CTA principal : générer / imprimer */}
          <div className="rounded-2xl border-2 border-orange-500/50 bg-orange-500/10 p-4 space-y-3">
            <p className="font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Printer className="text-orange-500" size={20} />
              Générer & imprimer les QR
            </p>
            <p className="text-xs text-stone-600 dark:text-stone-400">
              Affiche pro orange · 1 ou 4 QR par page A4 · prêt à plastifier
            </p>
            <Link
              to="/print-qr"
              className="btn-primary w-full min-h-[48px] flex items-center justify-center gap-2 text-base"
            >
              <QrCode size={18} />
              Ouvrir l&apos;imprimante QR tables
            </Link>
          </div>

          {/* Créer une nouvelle table (= nouveau QR) */}
          {canEdit && (
            <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 p-4 space-y-3">
              <p className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <Plus size={18} className="text-amber-500" />
                Générer un nouveau QR (nouvelle table)
              </p>
              <p className="text-xs text-stone-500">
                Chaque table a son propre QR. Créez la table ici, puis imprimez.
              </p>
              <div className="flex gap-2">
                <input
                  className="input-field flex-1"
                  placeholder={`Ex. T${tables.length + 1} ou Terrasse`}
                  value={newTableNum}
                  onChange={(e) => setNewTableNum(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-primary shrink-0 px-4"
                  disabled={addingTable}
                  onClick={() => void addTable()}
                >
                  {addingTable ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                </button>
              </div>
            </div>
          )}

          {/* Liste tables + mini QR */}
          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 p-4 space-y-3">
            <p className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <LayoutGrid size={18} />
              Tables ({tables.length})
            </p>
            {tables.length === 0 ? (
              <p className="text-sm text-stone-500">
                Aucune table. Créez-en une ci-dessus pour générer un QR.
              </p>
            ) : (
              <ul className="space-y-2">
                {tables.map((tb) => {
                  const url = orderUrl({
                    origin,
                    estKey,
                    table: tb.number,
                    kiosk: qrKiosk,
                  });
                  const qr = qrImageUrl(url, qrCfgLive, 120);
                  return (
                    <li
                      key={tb.id}
                      className="flex items-center gap-3 rounded-xl border border-stone-200 dark:border-stone-700 p-2"
                    >
                      <img src={qr} alt="" className="w-14 h-14 rounded-lg bg-white" width={56} height={56} />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-stone-900 dark:text-stone-100">
                          Table {tb.number}
                        </p>
                        <p className="text-[10px] text-stone-500 truncate">{url}</p>
                      </div>
                      <button
                        type="button"
                        className="text-xs text-amber-600 dark:text-amber-400 shrink-0"
                        onClick={() => void copyLink(url)}
                      >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link to="/tables" className="text-xs text-amber-600 dark:text-amber-400 hover:underline">
              Gérer les tables (statut, serveurs) →
            </Link>
          </div>

          {/* Activation */}
          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 p-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-stone-900 dark:text-stone-100">
                Commande via QR tables
              </p>
              <p className="text-xs text-stone-500 mt-0.5">
                {enabled ? 'Les scans ouvrent la page commande' : 'Désactivée'}
              </p>
            </div>
            {canEdit && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void toggleEnabled()}
                className="shrink-0 text-amber-600 dark:text-amber-400"
              >
                {enabled ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
              </button>
            )}
          </div>

          {/* Aperçu */}
          {sampleTableQr && (
            <div className="rounded-2xl border border-orange-500/30 bg-orange-50 dark:bg-orange-950/20 p-4 space-y-2 text-center">
              <p className="text-xs font-semibold uppercase text-orange-800 dark:text-orange-300">
                Aperçu
              </p>
              <p className="font-bold text-stone-900 dark:text-stone-100">
                {activeEstablishment?.name}
              </p>
              <img
                src={sampleTableQr}
                alt="Aperçu QR"
                className="mx-auto w-40 h-40 rounded-xl bg-white p-2"
              />
              <div className="rounded-lg bg-[#FF7900] text-white text-xs font-bold py-2">
                SCANNEZ CE QR CODE
              </div>
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() => void copyLink(sampleTableUrl)}
                >
                  {copied ? 'Copié' : 'Copier le lien'}
                </button>
                <a
                  href={sampleTableUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary text-xs flex items-center gap-1"
                >
                  <ExternalLink size={12} /> Tester
                </a>
              </div>
            </div>
          )}

          {/* Personnalisation */}
          {canEdit && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
              <h3 className="font-semibold text-stone-900 dark:text-stone-100">
                Personnaliser
              </h3>
              <label className="block text-xs text-stone-500">
                Identifiant URL (slug)
                <input
                  className="input-field mt-1"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="ex. gbaissai-chez-rco"
                />
              </label>
              <label className="block text-xs text-stone-500">
                Message d&apos;accueil / phrase QR
                <input
                  className="input-field mt-1"
                  value={qrWelcome}
                  onChange={(e) => setQrWelcome(e.target.value)}
                  maxLength={80}
                  placeholder="Scannez pour commander votre boisson"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs text-stone-500">
                  Couleur QR
                  <input
                    type="color"
                    className="mt-1 h-10 w-full rounded-lg border cursor-pointer"
                    value={`#${qrColor}`}
                    onChange={(e) => setQrColor(e.target.value.replace('#', ''))}
                  />
                </label>
                <label className="block text-xs text-stone-500">
                  Fond QR
                  <input
                    type="color"
                    className="mt-1 h-10 w-full rounded-lg border cursor-pointer"
                    value={`#${qrBg}`}
                    onChange={(e) => setQrBg(e.target.value.replace('#', ''))}
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300">
                <input
                  type="checkbox"
                  checked={qrKiosk}
                  onChange={(e) => setQrKiosk(e.target.checked)}
                />
                Mode kiosque
              </label>
              <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300">
                <input
                  type="checkbox"
                  checked={showStock}
                  onChange={(e) => setShowStock(e.target.checked)}
                />
                Afficher quantités sur la page commande
              </label>
              <button
                type="button"
                className="btn-primary w-full min-h-[44px]"
                disabled={saving}
                onClick={() => void saveQrConfig()}
              >
                {saving ? '…' : 'Enregistrer le QR Code'}
              </button>
            </div>
          )}

          <Link
            to="/print-qr"
            className="btn-secondary w-full min-h-[48px] flex items-center justify-center gap-2"
          >
            <Printer size={16} /> Imprimer les QR (affiche pro · 4 / A4)
          </Link>
        </div>
      )}
    </div>
  );
}
