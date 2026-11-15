import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Package, Percent, Plus, Trash2, Save, Loader2, Sparkles,
  ToggleLeft, ToggleRight, Tag,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { formatFCFA } from '@/lib/format';
import {
  normalizeBusinessType,
  BUSINESS_THEMES,
  getBusinessUI,
} from '@/lib/businessTypes';
import { EmptyState, Modal } from '@/components/ui';
import type { Product } from '@/lib/types';

type KitItem = {
  id?: string;
  product_id: string | null;
  product_name: string;
  qty: number;
  unit_price: number;
};

type Kit = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  active: boolean;
  items?: KitItem[];
};

type Promo = {
  id: string;
  name: string;
  description: string | null;
  promo_type: 'percent' | 'fixed' | 'buy_x_get_y' | 'kit';
  value: number;
  product_id: string | null;
  kit_id: string | null;
  buy_qty: number | null;
  get_qty: number | null;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
};

export default function KitsPromos() {
  const { member, activeEstablishment, effectiveRole } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const bizType = normalizeBusinessType(activeEstablishment?.type);
  const theme = BUSINESS_THEMES[bizType];
  const ui = getBusinessUI(bizType);
  const canEdit = ['super_admin', 'admin', 'owner', 'manager'].includes(
    String(effectiveRole || member?.role || '')
  );

  const [tab, setTab] = useState<'kits' | 'promos'>('kits');
  const [kits, setKits] = useState<Kit[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kitModal, setKitModal] = useState(false);
  const [promoModal, setPromoModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [kitForm, setKitForm] = useState({
    name: '',
    description: '',
    price: '',
    items: [] as KitItem[],
  });
  const [promoForm, setPromoForm] = useState({
    name: '',
    description: '',
    promo_type: 'percent' as Promo['promo_type'],
    value: '',
    product_id: '',
    buy_qty: '2',
    get_qty: '1',
    starts_at: '',
    ends_at: '',
  });

  const load = useCallback(async () => {
    if (!estId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const [kitsRes, promosRes, prodRes] = await Promise.all([
      supabase.from('product_kits').select('*').eq('establishment_id', estId).order('created_at', { ascending: false }),
      supabase.from('promotions').select('*').eq('establishment_id', estId).order('created_at', { ascending: false }),
      supabase.from('products').select('id, name, price, cost, stock, category').eq('establishment_id', estId).order('name'),
    ]);
    if (kitsRes.error && !kitsRes.error.message.includes('does not exist')) {
      setError(kitsRes.error.message);
    }
    const kitList = (kitsRes.data || []) as Kit[];
    // load items
    if (kitList.length > 0) {
      const ids = kitList.map((k) => k.id);
      const { data: items } = await supabase
        .from('product_kit_items')
        .select('*')
        .in('kit_id', ids);
      const byKit = new Map<string, KitItem[]>();
      for (const it of items || []) {
        const list = byKit.get(it.kit_id) || [];
        list.push({
          id: it.id,
          product_id: it.product_id,
          product_name: it.product_name,
          qty: Number(it.qty) || 1,
          unit_price: Number(it.unit_price) || 0,
        });
        byKit.set(it.kit_id, list);
      }
      for (const k of kitList) k.items = byKit.get(k.id) || [];
    }
    setKits(kitList);
    setPromos((promosRes.data || []) as Promo[]);
    setProducts((prodRes.data || []) as Product[]);
    setLoading(false);
  }, [estId]);

  useEffect(() => {
    void load();
  }, [load]);

  const kitCost = useMemo(() => {
    return kitForm.items.reduce((s, i) => s + i.qty * i.unit_price, 0);
  }, [kitForm.items]);

  function openNewKit() {
    setKitForm({ name: '', description: '', price: '', items: [] });
    setKitModal(true);
  }

  function addKitItem(productId: string) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setKitForm((f) => ({
      ...f,
      items: [
        ...f.items,
        {
          product_id: p.id,
          product_name: p.name,
          qty: 1,
          unit_price: Number(p.price) || 0,
        },
      ],
    }));
  }

  async function saveKit() {
    if (!estId || !canEdit || !kitForm.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const price = Number(kitForm.price) || kitCost;
      const { data, error: err } = await supabase
        .from('product_kits')
        .insert({
          establishment_id: estId,
          name: kitForm.name.trim(),
          description: kitForm.description.trim() || null,
          price,
          active: true,
        })
        .select('id')
        .single();
      if (err) throw err;
      if (data && kitForm.items.length > 0) {
        const rows = kitForm.items.map((i) => ({
          kit_id: data.id,
          product_id: i.product_id,
          product_name: i.product_name,
          qty: i.qty,
          unit_price: i.unit_price,
        }));
        await supabase.from('product_kit_items').insert(rows);
      }
      setKitModal(false);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur enregistrement kit — appliquez la migration Phase 2');
    } finally {
      setSaving(false);
    }
  }

  async function toggleKit(k: Kit) {
    if (!canEdit) return;
    await supabase.from('product_kits').update({ active: !k.active }).eq('id', k.id);
    await load();
  }

  async function removeKit(k: Kit) {
    if (!canEdit || !confirm(`Supprimer le kit « ${k.name} » ?`)) return;
    await supabase.from('product_kits').delete().eq('id', k.id);
    await load();
  }

  function openNewPromo() {
    setPromoForm({
      name: '',
      description: '',
      promo_type: 'percent',
      value: '10',
      product_id: '',
      buy_qty: '2',
      get_qty: '1',
      starts_at: '',
      ends_at: '',
    });
    setPromoModal(true);
  }

  async function savePromo() {
    if (!estId || !canEdit || !promoForm.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const { error: err } = await supabase.from('promotions').insert({
        establishment_id: estId,
        name: promoForm.name.trim(),
        description: promoForm.description.trim() || null,
        promo_type: promoForm.promo_type,
        value: Number(promoForm.value) || 0,
        product_id: promoForm.product_id || null,
        buy_qty: promoForm.promo_type === 'buy_x_get_y' ? Number(promoForm.buy_qty) || null : null,
        get_qty: promoForm.promo_type === 'buy_x_get_y' ? Number(promoForm.get_qty) || null : null,
        starts_at: promoForm.starts_at || null,
        ends_at: promoForm.ends_at || null,
        active: true,
      });
      if (err) throw err;
      setPromoModal(false);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur enregistrement promo');
    } finally {
      setSaving(false);
    }
  }

  async function togglePromo(p: Promo) {
    if (!canEdit) return;
    await supabase.from('promotions').update({ active: !p.active }).eq('id', p.id);
    await load();
  }

  async function removePromo(p: Promo) {
    if (!canEdit || !confirm(`Supprimer la promo « ${p.name} » ?`)) return;
    await supabase.from('promotions').delete().eq('id', p.id);
    await load();
  }

  if (!estId) {
    return (
      <EmptyState
        icon={<Package size={48} />}
        title="Aucun établissement"
        message="Sélectionnez un établissement."
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <div className="mb-5">
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: theme.primary }}>
          Offres · {ui.productPlural}
        </p>
        <h1 className="text-2xl font-bold text-stone-100 mt-0.5 flex items-center gap-2">
          <Sparkles size={22} style={{ color: theme.primary }} />
          Kits & Promotions
        </h1>
        <p className="text-sm text-stone-400 mt-1">
          Créez des packs (ex. 6 bières + 1 soda) et des promos du jour.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {error}
        </div>
      )}

      <div className="flex gap-2 mb-5">
        {(
          [
            { id: 'kits' as const, label: 'Kits / Packs', icon: <Package size={16} /> },
            { id: 'promos' as const, label: 'Promotions', icon: <Percent size={16} /> },
          ]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium border transition ${
              tab === t.id
                ? 'border-amber-500/50 bg-amber-500/15 text-amber-200'
                : 'border-stone-700 text-stone-400 hover:border-stone-600'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-stone-400 gap-2">
          <Loader2 className="animate-spin" size={18} /> Chargement…
        </div>
      ) : tab === 'kits' ? (
        <>
          {canEdit && (
            <button
              type="button"
              onClick={openNewKit}
              className="mb-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-stone-950"
              style={{ background: theme.primary }}
            >
              <Plus size={16} /> Nouveau kit
            </button>
          )}
          {kits.length === 0 ? (
            <EmptyState
              icon={<Package size={48} />}
              title="Aucun kit"
              message="Créez un pack (ex. « Happy Hour 6 + 1 ») pour vendre plus vite."
            />
          ) : (
            <ul className="space-y-3">
              {kits.map((k) => (
                <li
                  key={k.id}
                  className={`rounded-2xl border p-4 ${
                    k.active ? 'border-stone-800 bg-stone-900/60' : 'border-stone-800/50 bg-stone-950/40 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-stone-100">{k.name}</p>
                      {k.description && <p className="text-xs text-stone-500 mt-0.5">{k.description}</p>}
                      <p className="text-lg font-bold mt-1" style={{ color: theme.primary }}>
                        {formatFCFA(k.price)}
                      </p>
                      {k.items && k.items.length > 0 && (
                        <ul className="mt-2 text-xs text-stone-400 space-y-0.5">
                          {k.items.map((it, i) => (
                            <li key={i}>
                              {it.qty}× {it.product_name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void toggleKit(k)}
                          className="p-2 rounded-lg text-stone-400 hover:bg-stone-800"
                          title={k.active ? 'Désactiver' : 'Activer'}
                        >
                          {k.active ? <ToggleRight size={20} className="text-emerald-400" /> : <ToggleLeft size={20} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeKit(k)}
                          className="p-2 rounded-lg text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          {canEdit && (
            <button
              type="button"
              onClick={openNewPromo}
              className="mb-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-stone-950"
              style={{ background: theme.primary }}
            >
              <Plus size={16} /> Nouvelle promo
            </button>
          )}
          {promos.length === 0 ? (
            <EmptyState
              icon={<Tag size={48} />}
              title="Aucune promotion"
              message="Ex. −10 % sur les bières, 2+1 gratuit…"
            />
          ) : (
            <ul className="space-y-3">
              {promos.map((p) => (
                <li
                  key={p.id}
                  className={`rounded-2xl border p-4 ${
                    p.active ? 'border-stone-800 bg-stone-900/60' : 'border-stone-800/50 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-stone-100">{p.name}</p>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {p.promo_type === 'percent' && `−${p.value} %`}
                        {p.promo_type === 'fixed' && `−${formatFCFA(p.value)}`}
                        {p.promo_type === 'buy_x_get_y' && `${p.buy_qty}+${p.get_qty} gratuit`}
                        {p.starts_at && ` · dès ${p.starts_at}`}
                        {p.ends_at && ` → ${p.ends_at}`}
                      </p>
                      {p.description && <p className="text-sm text-stone-400 mt-1">{p.description}</p>}
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => void togglePromo(p)} className="p-2 rounded-lg text-stone-400 hover:bg-stone-800">
                          {p.active ? <ToggleRight size={20} className="text-emerald-400" /> : <ToggleLeft size={20} />}
                        </button>
                        <button type="button" onClick={() => void removePromo(p)} className="p-2 rounded-lg text-red-400 hover:bg-red-500/10">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* Kit modal */}
      <Modal open={kitModal} onClose={() => setKitModal(false)} title="Nouveau kit">
        <div className="space-y-3">
          <input
            className="input-field w-full"
            placeholder="Nom du kit (ex. Pack 6 Castel)"
            value={kitForm.name}
            onChange={(e) => setKitForm((f) => ({ ...f, name: e.target.value }))}
          />
          <textarea
            className="input-field w-full min-h-[60px]"
            placeholder="Description (optionnel)"
            value={kitForm.description}
            onChange={(e) => setKitForm((f) => ({ ...f, description: e.target.value }))}
          />
          <div>
            <label className="text-xs text-stone-500">Ajouter un produit</label>
            <select
              className="input-field w-full mt-1"
              value=""
              onChange={(e) => {
                if (e.target.value) addKitItem(e.target.value);
              }}
            >
              <option value="">— Choisir —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({formatFCFA(Number(p.price) || 0)})
                </option>
              ))}
            </select>
          </div>
          {kitForm.items.length > 0 && (
            <ul className="space-y-2">
              {kitForm.items.map((it, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm">
                  <input
                    type="number"
                    min={1}
                    className="w-16 input-field text-center"
                    value={it.qty}
                    onChange={(e) => {
                      const qty = Number(e.target.value) || 1;
                      setKitForm((f) => ({
                        ...f,
                        items: f.items.map((x, i) => (i === idx ? { ...x, qty } : x)),
                      }));
                    }}
                  />
                  <span className="flex-1 text-stone-200">{it.product_name}</span>
                  <button
                    type="button"
                    className="text-red-400 p-1"
                    onClick={() =>
                      setKitForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-500">Prix catalogue items : {formatFCFA(kitCost)}</span>
          </div>
          <input
            className="input-field w-full"
            type="number"
            placeholder={`Prix du kit (défaut ${kitCost})`}
            value={kitForm.price}
            onChange={(e) => setKitForm((f) => ({ ...f, price: e.target.value }))}
          />
          <button
            type="button"
            disabled={saving || !kitForm.name.trim()}
            onClick={() => void saveKit()}
            className="w-full btn-primary flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Enregistrer le kit
          </button>
        </div>
      </Modal>

      {/* Promo modal */}
      <Modal open={promoModal} onClose={() => setPromoModal(false)} title="Nouvelle promotion">
        <div className="space-y-3">
          <input
            className="input-field w-full"
            placeholder="Nom (ex. Happy Hour −15 %)"
            value={promoForm.name}
            onChange={(e) => setPromoForm((f) => ({ ...f, name: e.target.value }))}
          />
          <select
            className="input-field w-full"
            value={promoForm.promo_type}
            onChange={(e) =>
              setPromoForm((f) => ({ ...f, promo_type: e.target.value as Promo['promo_type'] }))
            }
          >
            <option value="percent">Réduction %</option>
            <option value="fixed">Réduction fixe (FCFA)</option>
            <option value="buy_x_get_y">Achetez X obtenez Y</option>
          </select>
          {promoForm.promo_type !== 'buy_x_get_y' ? (
            <input
              className="input-field w-full"
              type="number"
              placeholder={promoForm.promo_type === 'percent' ? 'Pourcentage (ex. 10)' : 'Montant FCFA'}
              value={promoForm.value}
              onChange={(e) => setPromoForm((f) => ({ ...f, value: e.target.value }))}
            />
          ) : (
            <div className="flex gap-2">
              <input
                className="input-field flex-1"
                type="number"
                placeholder="Achetez"
                value={promoForm.buy_qty}
                onChange={(e) => setPromoForm((f) => ({ ...f, buy_qty: e.target.value }))}
              />
              <input
                className="input-field flex-1"
                type="number"
                placeholder="Obtenez gratuit"
                value={promoForm.get_qty}
                onChange={(e) => setPromoForm((f) => ({ ...f, get_qty: e.target.value }))}
              />
            </div>
          )}
          <select
            className="input-field w-full"
            value={promoForm.product_id}
            onChange={(e) => setPromoForm((f) => ({ ...f, product_id: e.target.value }))}
          >
            <option value="">Tous les produits (optionnel)</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              type="date"
              className="input-field flex-1"
              value={promoForm.starts_at}
              onChange={(e) => setPromoForm((f) => ({ ...f, starts_at: e.target.value }))}
            />
            <input
              type="date"
              className="input-field flex-1"
              value={promoForm.ends_at}
              onChange={(e) => setPromoForm((f) => ({ ...f, ends_at: e.target.value }))}
            />
          </div>
          <textarea
            className="input-field w-full min-h-[60px]"
            placeholder="Description"
            value={promoForm.description}
            onChange={(e) => setPromoForm((f) => ({ ...f, description: e.target.value }))}
          />
          <button
            type="button"
            disabled={saving || !promoForm.name.trim()}
            onClick={() => void savePromo()}
            className="w-full btn-primary flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Enregistrer la promo
          </button>
        </div>
      </Modal>
    </div>
  );
}
