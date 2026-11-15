import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardCheck, Search, Save, Loader2, AlertTriangle,
  Package, CheckCircle2, ArrowLeft, RefreshCw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  normalizeBusinessType,
  getBusinessUI,
  BUSINESS_THEMES,
} from '@/lib/businessTypes';
import { todayISO, formatFCFA } from '@/lib/format';
import { EmptyState } from '@/components/ui';
import ProductThumb from '@/components/ProductThumb';
import { logAudit, newClientOpId } from '@/lib/audit';

type ProductRow = {
  id: string;
  name: string;
  category: string | null;
  stock: number;
  min_stock: number;
  cost: number;
  price: number;
  unit: string | null;
  image_url?: string | null;
  units_per_package?: number | null;
};

type CountMap = Record<string, string>; // product_id -> counted qty as string

export default function PointManuel() {
  const { member, activeEstablishment, effectiveRole } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const bizType = normalizeBusinessType(activeEstablishment?.type);
  const ui = getBusinessUI(bizType);
  const theme = BUSINESS_THEMES[bizType];
  const role = String(effectiveRole || member?.role || '');
  const canEdit = ['super_admin', 'admin', 'owner', 'manager', 'cashier'].includes(role);

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [counts, setCounts] = useState<CountMap>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterDiff, setFilterDiff] = useState<'all' | 'diff' | 'zero'>('all');

  const load = useCallback(async () => {
    if (!estId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    let data: ProductRow[] | null = null;
    let err: { message?: string } | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await supabase
        .from('products')
        .select('id, name, category, stock, min_stock, cost, price, unit, image_url, units_per_package')
        .eq('establishment_id', estId)
        .order('name');
      data = (res.data as ProductRow[]) || null;
      err = res.error;
      if (!err && data && data.length) break;
      if (!err && data && data.length === 0) break;
      await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
    }
    if (err) {
      setError(err.message || 'Erreur chargement');
      setLoading(false);
      return;
    }
    const rows = (data || []) as ProductRow[];
    setProducts(rows);
    const init: CountMap = {};
    for (const p of rows) {
      init[p.id] = String(Number(p.stock) || 0);
    }
    setCounts(init);
    setSaved(false);
    setLoading(false);
  }, [estId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return products.filter((p) => {
      const matchQ =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q);
      if (!matchQ) return false;
      const theoretical = Number(p.stock) || 0;
      const counted = Number(counts[p.id] ?? theoretical);
      if (filterDiff === 'diff' && counted === theoretical) return false;
      if (filterDiff === 'zero' && counted > 0) return false;
      return true;
    });
  }, [products, search, counts, filterDiff]);

  const summary = useMemo(() => {
    let diffs = 0;
    let missing = 0;
    let surplus = 0;
    let valueDelta = 0;
    for (const p of products) {
      const theoretical = Number(p.stock) || 0;
      const counted = Number(counts[p.id] ?? theoretical);
      const d = counted - theoretical;
      if (d !== 0) {
        diffs++;
        if (d < 0) missing += -d;
        else surplus += d;
        valueDelta += d * (Number(p.cost) || 0);
      }
    }
    return { diffs, missing, surplus, valueDelta };
  }, [products, counts]);

  function setCount(id: string, value: string) {
    const cleaned = value.replace(/[^\d.-]/g, '');
    setCounts((prev) => ({ ...prev, [id]: cleaned }));
    setSaved(false);
  }

  async function applyCounts() {
    if (!estId || !canEdit || saving) return;
    const changes = products.filter((p) => {
      const theoretical = Number(p.stock) || 0;
      const counted = Number(counts[p.id] ?? theoretical);
      return counted !== theoretical;
    });
    if (changes.length === 0) {
      setError('Aucune différence à enregistrer.');
      return;
    }
    setSaving(true);
    setError(null);
    const opId = newClientOpId();
    try {
      for (const p of changes) {
        const counted = Math.max(0, Number(counts[p.id]) || 0);
        const theoretical = Number(p.stock) || 0;
        const delta = counted - theoretical;
        const { error: upErr } = await supabase
          .from('products')
          .update({ stock: counted, updated_at: new Date().toISOString() })
          .eq('id', p.id)
          .eq('establishment_id', estId);
        if (upErr) throw upErr;
        // movement log if table exists
        try {
          await supabase.from('stock_movements').insert({
            establishment_id: estId,
            product_id: p.id,
            quantity: delta,
            type: 'adjustment',
            reason: `Point manuel ${todayISO()}`,
            created_by: member?.user_id || null,
          });
        } catch { /* table may not have all columns */ }
      }
      await logAudit({
        establishment_id: estId,
        action: 'point_manuel',
        entity_type: 'products',
        entity_id: null,
        reason: `Point manuel ${todayISO()} — ${changes.length} produit(s)`,
        actor_id: member?.user_id || null,
        client_op_id: opId,
        new_value: { count: changes.length, date: todayISO() },
      });
      setSaved(true);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de l’enregistrement');
    } finally {
      setSaving(false);
    }
  }

  if (!estId) {
    return (
      <EmptyState
        icon={<ClipboardCheck size={48} />}
        title="Aucun établissement"
        message="Sélectionnez un établissement pour faire le point."
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-24">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-stone-400 hover:text-stone-200"
        >
          <ArrowLeft size={16} /> Accueil
        </Link>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-stone-700 bg-stone-800 px-3 py-1.5 text-xs text-stone-300 hover:bg-stone-700"
        >
          <RefreshCw size={14} /> Recharger
        </button>
      </div>

      <div className="mb-5">
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: theme.primary }}>
          Point manuel · {ui.inventoryTitle}
        </p>
        <h1 className="text-2xl font-bold text-stone-100 mt-0.5">Comptage fin de journée</h1>
        <p className="text-sm text-stone-400 mt-1">
          Saisissez les quantités restantes. Les écarts ajusteront automatiquement le stock.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <div className="rounded-xl border border-stone-800 bg-stone-900/60 px-3 py-2">
          <p className="text-[11px] text-stone-500">Écarts</p>
          <p className="text-lg font-semibold text-stone-100">{summary.diffs}</p>
        </div>
        <div className="rounded-xl border border-stone-800 bg-stone-900/60 px-3 py-2">
          <p className="text-[11px] text-stone-500">Manquants</p>
          <p className="text-lg font-semibold text-red-400">{summary.missing}</p>
        </div>
        <div className="rounded-xl border border-stone-800 bg-stone-900/60 px-3 py-2">
          <p className="text-[11px] text-stone-500">Surplus</p>
          <p className="text-lg font-semibold text-emerald-400">{summary.surplus}</p>
        </div>
        <div className="rounded-xl border border-stone-800 bg-stone-900/60 px-3 py-2">
          <p className="text-[11px] text-stone-500">Valeur Δ</p>
          <p className={`text-lg font-semibold ${summary.valueDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatFCFA(summary.valueDelta)}
          </p>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Rechercher ${ui.productSingular.toLowerCase()}…`}
            className="w-full rounded-xl border border-stone-700 bg-stone-900 pl-9 pr-3 py-2 text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          />
        </div>
        {(['all', 'diff', 'zero'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilterDiff(f)}
            className={`rounded-xl px-3 py-2 text-xs font-medium border transition ${
              filterDiff === f
                ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
                : 'border-stone-700 bg-stone-900 text-stone-400 hover:border-stone-600'
            }`}
          >
            {f === 'all' ? 'Tous' : f === 'diff' ? 'Écarts seulement' : 'À zéro'}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      {saved && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          <CheckCircle2 size={16} /> Point enregistré — stock mis à jour
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-stone-400 gap-2">
          <Loader2 size={18} className="animate-spin" /> Chargement…
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Package size={48} />}
          title="Aucun produit"
          message={ui.emptyProducts}
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((p) => {
            const theoretical = Number(p.stock) || 0;
            const counted = Number(counts[p.id] ?? theoretical);
            const delta = counted - theoretical;
            return (
              <li
                key={p.id}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                  delta !== 0
                    ? 'border-amber-500/30 bg-amber-500/5'
                    : 'border-stone-800 bg-stone-900/50'
                }`}
              >
                <ProductThumb name={p.name} imageUrl={p.image_url} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-100 truncate">{p.name}</p>
                  <p className="text-xs text-stone-500">
                    Théorique : <span className="text-stone-300">{theoretical}</span>
                    {p.unit ? ` ${p.unit}` : ''}
                    {delta !== 0 && (
                      <span className={`ml-2 font-medium ${delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {delta > 0 ? '+' : ''}{delta}
                      </span>
                    )}
                  </p>
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  disabled={!canEdit}
                  value={counts[p.id] ?? ''}
                  onChange={(e) => setCount(p.id, e.target.value)}
                  className="w-20 rounded-lg border border-stone-700 bg-stone-950 px-2 py-1.5 text-center text-sm font-semibold text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </li>
            );
          })}
        </ul>
      )}

      {/* Sticky save bar */}
      {canEdit && products.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 border-t border-stone-800 bg-stone-950/95 backdrop-blur px-4 py-3 safe-pb">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <p className="text-xs text-stone-400">
              {summary.diffs > 0
                ? `${summary.diffs} produit(s) à ajuster`
                : 'Aucune différence'}
            </p>
            <button
              type="button"
              disabled={saving || summary.diffs === 0}
              onClick={() => void applyCounts()}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-stone-950 disabled:opacity-50"
              style={{ background: theme.primary }}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Valider le point
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
