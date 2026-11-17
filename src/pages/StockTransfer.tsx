import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft, Loader2, Package, Search, Save, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, type MyEstablishment } from '@/lib/auth';
import {
  normalizeBusinessType,
  BUSINESS_THEMES,
  BUSINESS_LABELS,
} from '@/lib/businessTypes';
import { formatFCFA } from '@/lib/format';
import { EmptyState } from '@/components/ui';
import ProductThumb from '@/components/ProductThumb';
import { logAudit, newClientOpId } from '@/lib/audit';

type ProductRow = {
  id: string;
  name: string;
  category: string | null;
  stock: number;
  cost: number;
  price: number;
  unit: string | null;
  image_url?: string | null;
};

export default function StockTransfer() {
  const { member, activeEstablishment, myEstablishments, effectiveRole } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const bizType = normalizeBusinessType(activeEstablishment?.type);
  const theme = BUSINESS_THEMES[bizType];
  const canTransfer = ['super_admin', 'admin', 'owner', 'manager'].includes(
    String(effectiveRole || member?.role || '')
  );

  const [estList, setEstList] = useState<MyEstablishment[]>([]);
  const [targetId, setTargetId] = useState('');
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [qtyMap, setQtyMap] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load establishments the user can access
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (myEstablishments && myEstablishments.length > 0) {
        if (!cancelled) setEstList(myEstablishments);
        return;
      }
      if (!member?.user_id) return;
      const { data: links } = await supabase
        .from('member_establishments')
        .select('establishment_id')
        .eq('user_id', member.user_id)
        .eq('status', 'active');
      const ids = (links || []).map((l) => l.establishment_id).filter(Boolean);
      if (member.establishment_id && !ids.includes(member.establishment_id)) {
        ids.push(member.establishment_id);
      }
      // also owned
      const { data: owned } = await supabase
        .from('establishments')
        .select('id, name, type, address, phone, created_at')
        .eq('created_by', member.user_id);
      const map = new Map<string, MyEstablishment>();
      for (const o of owned || []) map.set(o.id, o as MyEstablishment);
      if (ids.length) {
        const { data: ests } = await supabase.from('establishments').select('*').in('id', ids);
        for (const e of ests || []) map.set(e.id, e as MyEstablishment);
      }
      if (!cancelled) setEstList(Array.from(map.values()));
    })();
    return () => {
      cancelled = true;
    };
  }, [member, myEstablishments]);

  const loadProducts = useCallback(async () => {
    if (!estId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('products')
      .select('id, name, category, stock, cost, price, unit, image_url')
      .eq('establishment_id', estId)
      .gt('stock', 0)
      .order('name');
    setProducts((data || []) as ProductRow[]);
    setQtyMap({});
    setLoading(false);
  }, [estId]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const targets = useMemo(
    () => estList.filter((e) => e.id !== estId),
    [estList, estId]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q)
    );
  }, [products, search]);

  const lines = useMemo(() => {
    return products
      .map((p) => {
        const q = Math.max(0, Number(qtyMap[p.id]) || 0);
        return q > 0 ? { product: p, qty: Math.min(q, Number(p.stock) || 0) } : null;
      })
      .filter(Boolean) as { product: ProductRow; qty: number }[];
  }, [products, qtyMap]);

  async function executeTransfer() {
    if (!estId || !targetId || !canTransfer || lines.length === 0) return;
    setSaving(true);
    setError(null);
    setMsg(null);
    const opId = newClientOpId();
    try {
      for (const { product, qty } of lines) {
        // decrement source
        const newSrc = Math.max(0, (Number(product.stock) || 0) - qty);
        const { error: e1 } = await supabase
          .from('products')
          .update({ stock: newSrc, updated_at: new Date().toISOString() })
          .eq('id', product.id)
          .eq('establishment_id', estId);
        if (e1) throw e1;

        // find or create product on target by name
        const { data: existing } = await supabase
          .from('products')
          .select('id, stock')
          .eq('establishment_id', targetId)
          .ilike('name', product.name)
          .limit(1)
          .maybeSingle();

        if (existing?.id) {
          const newT = (Number(existing.stock) || 0) + qty;
          const { error: e2 } = await supabase
            .from('products')
            .update({ stock: newT, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
          if (e2) throw e2;
        } else {
          const { error: e3 } = await supabase.from('products').insert({
            establishment_id: targetId,
            name: product.name,
            category: product.category || 'Autre',
            stock: qty,
            min_stock: 0,
            cost: product.cost || 0,
            price: product.price || 0,
            unit: product.unit || 'unité',
            image_url: product.image_url || null,
          });
          if (e3) throw e3;
        }

        try {
          await supabase.from('stock_movements').insert([
            {
              establishment_id: estId,
              product_id: product.id,
              quantity: -qty,
              movement_type: 'transfer_out',
              reason: `Transfert vers ${targetId}`,
              created_by: member?.user_id || null,
            },
            {
              establishment_id: targetId,
              product_id: existing?.id || null,
              quantity: qty,
              movement_type: 'transfer_in',
              reason: `Transfert depuis ${estId}`,
              created_by: member?.user_id || null,
            },
          ]);
        } catch { /* optional */ }
      }

      await logAudit({
        establishment_id: estId,
        action: 'stock_transfer',
        entity_type: 'products',
        actor_id: member?.user_id || null,
        client_op_id: opId,
        reason: `Transfert de ${lines.length} ligne(s) vers ${targetId}`,
        new_value: {
          target: targetId,
          lines: lines.map((l) => ({ name: l.product.name, qty: l.qty })),
        },
      });

      setMsg(`Transfert réussi : ${lines.length} produit(s) envoyés.`);
      setQtyMap({});
      await loadProducts();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors du transfert');
    } finally {
      setSaving(false);
    }
  }

  if (!estId) {
    return (
      <EmptyState
        icon={<ArrowRightLeft size={48} />}
        title="Aucun établissement"
        message="Sélectionnez un établissement source."
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-24">
      <div className="mb-5">
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: theme.primary }}>
          Multi-établissements
        </p>
        <h1 className="text-2xl font-bold text-stone-100 mt-0.5 flex items-center gap-2">
          <ArrowRightLeft size={22} style={{ color: theme.primary }} />
          Transfert de stock
        </h1>
        <p className="text-sm text-stone-400 mt-1">
          Déplacez des quantités de <strong className="text-stone-300">{activeEstablishment?.name}</strong> vers un autre de vos établissements.
        </p>
      </div>

      {targets.length === 0 ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          Vous n’avez qu’un seul établissement. Créez-en un second (Paramètres) pour activer les transferts.
        </div>
      ) : (
        <>
          <label className="text-xs text-stone-500">Établissement destination</label>
          <select
            className="input-field w-full mt-1 mb-4"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
          >
            <option value="">— Choisir —</option>
            {targets.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({BUSINESS_LABELS[normalizeBusinessType(e.type)] || e.type})
              </option>
            ))}
          </select>

          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un produit…"
              className="input-field w-full pl-9"
            />
          </div>

          {error && (
            <div className="mb-3 flex gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}
          {msg && (
            <div className="mb-3 flex gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              <CheckCircle2 size={16} /> {msg}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12 text-stone-400 gap-2">
              <Loader2 className="animate-spin" size={18} /> Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Package size={48} />}
              title="Aucun stock disponible"
              message="Aucun produit avec stock &gt; 0 dans cet établissement."
            />
          ) : (
            <ul className="space-y-2">
              {filtered.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border border-stone-800 bg-stone-900/50 px-3 py-2.5"
                >
                  <ProductThumb name={p.name} category={p.category} imageUrl={p.image_url} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-100 truncate">{p.name}</p>
                    <p className="text-xs text-stone-500">
                      Stock : {p.stock} · {formatFCFA(Number(p.cost) || 0)}
                    </p>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={p.stock}
                    disabled={!canTransfer}
                    placeholder="0"
                    value={qtyMap[p.id] ?? ''}
                    onChange={(e) =>
                      setQtyMap((m) => ({ ...m, [p.id]: e.target.value }))
                    }
                    className="w-20 rounded-lg border border-stone-700 bg-stone-950 px-2 py-1.5 text-center text-sm font-semibold text-stone-100"
                  />
                </li>
              ))}
            </ul>
          )}

          {canTransfer && lines.length > 0 && targetId && (
            <div className="fixed bottom-0 inset-x-0 z-30 border-t border-stone-800 bg-stone-950/95 backdrop-blur px-4 py-3">
              <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
                <p className="text-xs text-stone-400">{lines.length} ligne(s) à transférer</p>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void executeTransfer()}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-stone-950 disabled:opacity-50"
                  style={{ background: theme.primary }}
                >
                  {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  Valider le transfert
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
