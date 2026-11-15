import { useEffect, useState } from 'react';
import { Package, Plus, Loader2, Minus, Trash2, Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { formatFCFA } from '@/lib/format';
import { EmptyState, Modal } from '@/components/ui';
import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_CATEGORY_LABELS,
} from '@/lib/businessTypes';
import type { RentalEquipment } from '@/lib/rentalTypes';

const emptyForm = {
  name: '',
  category: 'chaises',
  qty_total: 0,
  qty_available: 0,
  qty_reserved: 0,
  qty_out: 0,
  qty_damaged: 0,
  unit_price: 0,
  description: '',
};

export default function RentEquipment() {
  const { member, activeEstablishment } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const [items, setItems] = useState<RentalEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customCategory, setCustomCategory] = useState(false);
  const [categoryInput, setCategoryInput] = useState('');

  async function load() {
    if (!estId) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('rental_equipment')
      .select('*')
      .eq('establishment_id', member.establishment_id)
      .order('category')
      .order('name');
    setItems((data ?? []) as RentalEquipment[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estId]);

  function openCreate() {
    setEditId(null);
    setForm(emptyForm);
    setCustomCategory(false);
    setCategoryInput('');
    setError(null);
    setOpen(true);
  }

  function openEdit(it: RentalEquipment, e?: React.MouseEvent) {
    e?.stopPropagation();
    setEditId(it.id);
    setForm({
      name: it.name,
      category: it.category || 'chaises',
      qty_total: Number(it.qty_total) || 0,
      qty_available: Number(it.qty_available) || 0,
      qty_reserved: Number(it.qty_reserved) || 0,
      qty_out: Number(it.qty_out) || 0,
      qty_damaged: Number(it.qty_damaged) || 0,
      unit_price: Number(it.unit_price) || 0,
      description: it.description || '',
    });
    setCustomCategory(!(EQUIPMENT_CATEGORIES as readonly string[]).includes(it.category));
    setCategoryInput(it.category || '');
    setError(null);
    setOpen(true);
  }

  async function adjustQty(it: RentalEquipment, delta: number, e: React.MouseEvent) {
    e.stopPropagation();
    const newTotal = Math.max(0, Number(it.qty_total) + delta);
    const diff = newTotal - Number(it.qty_total);
    const newAvail = Math.max(0, Number(it.qty_available) + diff);
    const { error: err } = await supabase
      .from('rental_equipment')
      .update({ qty_total: newTotal, qty_available: newAvail })
      .eq('id', it.id);
    if (err) setError(err.message);
    else await load();
  }

  async function removeItem(it: RentalEquipment, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Supprimer ${it.name} ?`)) return;
    await supabase.from('rental_equipment').delete().eq('id', it.id);
    await load();
  }

  async function save() {
    if (!estId || !form.name.trim()) {
      setError('Le nom est obligatoire');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      category: form.category,
      description: form.description || null,
      qty_total: Math.max(0, Number(form.qty_total) || 0),
      qty_available: Math.max(0, Number(form.qty_available) || 0),
      qty_reserved: Math.max(0, Number(form.qty_reserved) || 0),
      qty_out: Math.max(0, Number(form.qty_out) || 0),
      qty_damaged: Math.max(0, Number(form.qty_damaged) || 0),
      unit_price: Number(form.unit_price) || 0,
    };

    let err;
    if (editId) {
      ({ error: err } = await supabase.from('rental_equipment').update(payload).eq('id', editId));
    } else {
      ({ error: err } = await supabase.from('rental_equipment').insert({
        establishment_id: member.establishment_id,
        ...payload,
        qty_available: payload.qty_available || payload.qty_total,
      }));
    }
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setOpen(false);
    setEditId(null);
    setForm(emptyForm);
    await load();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary-500" size={28} />
      </div>
    );
  }

  if (!estId) {
    return (
      <EmptyState
        icon={<Package size={48} />}
        title="Aucun établissement"
        message="Créez une activité Location événementielle."
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100">Matériel</h1>
          <p className="text-stone-400 text-sm">Touchez une carte pour modifier · ± pour le stock</p>
        </div>
        <button type="button" onClick={openCreate} className="btn-primary flex items-center gap-2 shrink-0">
          <Plus size={18} /> Ajouter
        </button>
      </div>

      {error && !open && (
        <div className="mb-3 text-sm text-error-300 bg-error-500/10 border border-error-500/30 rounded-xl p-3">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState icon={<Package size={48} />} title="Aucun matériel" message="Ajoutez chaises, tables, bâches, etc." />
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <button
              type="button"
              key={it.id}
              onClick={() => openEdit(it)}
              className="card w-full text-left flex flex-wrap gap-3 items-center active:scale-[0.99] transition-transform"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-stone-100 flex items-center gap-2">
                  {it.name}
                  <Pencil size={14} className="text-stone-500 shrink-0" />
                </p>
                <p className="text-xs text-stone-500">
                  {EQUIPMENT_CATEGORY_LABELS[it.category] || it.category} · {formatFCFA(Number(it.unit_price))}/j
                </p>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div>
                  <p className="text-stone-500">Total</p>
                  <p className="font-semibold text-stone-200">{it.qty_total}</p>
                </div>
                <div>
                  <p className="text-stone-500">Dispo</p>
                  <p className="font-semibold text-success-400">{it.qty_available}</p>
                </div>
                <div>
                  <p className="text-stone-500">Réservé</p>
                  <p className="font-semibold text-amber-400">{it.qty_reserved}</p>
                </div>
                <div>
                  <p className="text-stone-500">Dehors</p>
                  <p className="font-semibold text-primary-400">{it.qty_out}</p>
                </div>
              </div>
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="p-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200"
                  onClick={(e) => adjustQty(it, -1, e)}
                  title="Diminuer"
                >
                  <Minus size={16} />
                </button>
                <button
                  type="button"
                  className="p-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200"
                  onClick={(e) => adjustQty(it, 1, e)}
                  title="Augmenter"
                >
                  <Plus size={16} />
                </button>
                <button
                  type="button"
                  className="p-2.5 rounded-lg hover:bg-error-500/10 text-stone-400 hover:text-error-400"
                  onClick={(e) => removeItem(it, e)}
                  title="Supprimer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </button>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setEditId(null);
        }}
        title={editId ? 'Modifier le matériel' : 'Nouveau matériel'}
      >
        <div className="space-y-3">
          {error && (
            <div className="text-sm text-error-300 bg-error-500/10 border border-error-500/30 rounded-xl p-3">{error}</div>
          )}
          <div>
            <label className="label">Nom</label>
            <input
              className="input-field"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Chaise pliante"
            />
          </div>
          <div>
            <label className="label">Catégorie</label>
            {!customCategory ? (
              <>
                <select
                  className="input-field"
                  value={
                    [...EQUIPMENT_CATEGORIES, ...items.map((i) => i.category)].map(String).includes(form.category)
                      ? form.category
                      : form.category
                      ? '__custom__'
                      : 'chaises'
                  }
                  onChange={(e) => {
                    if (e.target.value === '__new__') {
                      setCustomCategory(true);
                      setCategoryInput('');
                      setForm({ ...form, category: '' });
                    } else if (e.target.value === '__custom__') {
                      setCustomCategory(true);
                      setCategoryInput(form.category);
                    } else {
                      setCustomCategory(false);
                      setForm({ ...form, category: e.target.value });
                    }
                  }}
                >
                  {Array.from(
                    new Set([
                      ...EQUIPMENT_CATEGORIES,
                      ...items.map((i) => i.category).filter(Boolean),
                      ...(form.category && !(EQUIPMENT_CATEGORIES as readonly string[]).includes(form.category)
                        ? [form.category]
                        : []),
                    ])
                  ).map((c) => (
                    <option key={c} value={c}>
                      {EQUIPMENT_CATEGORY_LABELS[c] || c}
                    </option>
                  ))}
                  <option value="__new__">+ Nouvelle catégorie…</option>
                </select>
              </>
            ) : (
              <div className="space-y-2">
                <input
                  className="input-field"
                  value={categoryInput || form.category}
                  onChange={(e) => {
                    setCategoryInput(e.target.value);
                    setForm({ ...form, category: e.target.value.trim() || 'autres' });
                  }}
                  placeholder="Ex: Podium, Générateur, Tapis…"
                  autoFocus
                />
                <button
                  type="button"
                  className="text-xs text-primary-400"
                  onClick={() => {
                    setCustomCategory(false);
                    if (!form.category) setForm({ ...form, category: 'autres' });
                  }}
                >
                  ← Revenir à la liste
                </button>
              </div>
            )}
            <p className="text-xs text-stone-500 mt-1">Choisissez une catégorie ou créez-en une nouvelle</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Prix / jour (FCFA)</label>
              <input
                type="number"
                min={0}
                className="input-field"
                value={form.unit_price}
                onChange={(e) => setForm({ ...form, unit_price: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Total</label>
              <input
                type="number"
                min={0}
                className="input-field"
                value={form.qty_total}
                onChange={(e) => setForm({ ...form, qty_total: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Disponible</label>
              <input
                type="number"
                min={0}
                className="input-field"
                value={form.qty_available}
                onChange={(e) => setForm({ ...form, qty_available: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Réservé</label>
              <input
                type="number"
                min={0}
                className="input-field"
                value={form.qty_reserved}
                onChange={(e) => setForm({ ...form, qty_reserved: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Dehors</label>
              <input
                type="number"
                min={0}
                className="input-field"
                value={form.qty_out}
                onChange={(e) => setForm({ ...form, qty_out: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Endommagé</label>
              <input
                type="number"
                min={0}
                className="input-field"
                value={form.qty_damaged}
                onChange={(e) => setForm({ ...form, qty_damaged: Number(e.target.value) })}
              />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <input
              className="input-field"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <button type="button" onClick={save} disabled={saving} className="btn-primary w-full">
            {saving ? <Loader2 className="animate-spin mx-auto" size={18} /> : editId ? 'Enregistrer les modifications' : 'Créer'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
