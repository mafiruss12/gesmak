import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Pencil, Loader2, Check, Camera } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import {
  listCategories,
  listMenuItems,
  upsertCategory,
  deleteCategory,
  upsertMenuItem,
  deleteMenuItem,
  listOptions,
  upsertOption,
  deleteOption,
  parseMenuItemMeta,
  type MenuCategory,
  type MenuItem,
  type MenuItemOption,
} from '@/lib/restaurant';
import { formatFCFA } from '@/lib/format';
import { Modal, EmptyState } from '@/components/ui';

export default function MenuCarte() {
  const { member, activeEstablishment } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const [cats, setCats] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [catModal, setCatModal] = useState(false);
  const [catName, setCatName] = useState('');
  const [editCat, setEditCat] = useState<MenuCategory | null>(null);
  const [itemModal, setItemModal] = useState(false);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({
    name: '',
    price: '',
    category_id: '',
    description: '',
    linked_product_id: '',
    is_available: true,
    is_daily_menu: false,
    is_weekend_promo: false,
    promo_price: '',
    image_url: '',
  });
  const [optFor, setOptFor] = useState<MenuItem | null>(null);
  const [options, setOptions] = useState<MenuItemOption[]>([]);
  const [optName, setOptName] = useState('');
  const [optDelta, setOptDelta] = useState('0');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!estId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [c, i, p] = await Promise.all([
        listCategories(estId),
        listMenuItems(estId),
        supabase.from('products').select('id, name').eq('establishment_id', estId).order('name'),
      ]);
      setCats(c);
      setItems(i);
      setProducts((p.data || []) as { id: string; name: string }[]);
    } catch (e: any) {
      setMsg(e?.message || 'Erreur chargement carte');
    } finally {
      setLoading(false);
    }
  }, [estId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePhotoUpload(file: File) {
    if (!estId) return;
    setUploadingPhoto(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${estId}/menu-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('public-vitrine')
        .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });
      if (!upErr) {
        const { data } = supabase.storage.from('public-vitrine').getPublicUrl(path);
        if (data?.publicUrl) {
          setForm((f) => ({ ...f, image_url: data.publicUrl }));
          return;
        }
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setForm((f) => ({ ...f, image_url: reader.result as string }));
        }
      };
      reader.readAsDataURL(file);
    } catch (e: any) {
      setMsg(e?.message || 'Photo non téléversée');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function saveCat() {
    if (!estId || !catName.trim()) return;
    setBusy(true);
    try {
      await upsertCategory(estId, catName.trim(), editCat?.sort_order ?? cats.length, editCat?.id);
      setCatModal(false);
      setEditCat(null);
      setCatName('');
      await load();
    } catch (e: any) {
      setMsg(e?.message || 'Erreur catégorie');
    } finally {
      setBusy(false);
    }
  }

  async function saveItem() {
    if (!estId || !form.name.trim()) return;
    setBusy(true);
    try {
      await upsertMenuItem(
        estId,
        {
          name: form.name.trim(),
          price: Number(form.price) || 0,
          category_id: form.category_id || null,
          description: form.description || null,
          linked_product_id: form.linked_product_id || null,
          is_available: form.is_available,
          is_daily_menu: form.is_daily_menu,
          is_weekend_promo: form.is_weekend_promo,
          promo_price: form.promo_price ? Number(form.promo_price) : null,
          image_url: form.image_url.trim() || null,
        },
        editItem?.id,
      );
      setItemModal(false);
      setEditItem(null);
      await load();
    } catch (e: any) {
      setMsg(e?.message || 'Erreur plat');
    } finally {
      setBusy(false);
    }
  }

  async function openOptions(item: MenuItem) {
    setOptFor(item);
    setOptions(await listOptions(item.id));
  }

  async function addOpt() {
    if (!optFor || !optName.trim()) return;
    setBusy(true);
    try {
      await upsertOption(optFor.id, { name: optName.trim(), price_delta: Number(optDelta) || 0 });
      setOptName('');
      setOptDelta('0');
      setOptions(await listOptions(optFor.id));
    } catch (e: any) {
      setMsg(e?.message || 'Erreur option');
    } finally {
      setBusy(false);
    }
  }

  if (!estId) {
    return <div className="card p-4 text-sm text-stone-500">Sélectionnez un établissement.</div>;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-stone-500">
        <Loader2 className="animate-spin" size={18} /> Chargement de la carte…
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-24">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">Carte du restaurant</h1>
          <p className="text-sm text-stone-500">Catégories, plats, options et lien stock</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => {
              setEditCat(null);
              setCatName('');
              setCatModal(true);
            }}
          >
            <Plus size={16} /> Catégorie
          </button>
          <button
            type="button"
            className="btn-primary text-sm"
            onClick={() => {
              setEditItem(null);
              setForm({
                name: '',
                price: '',
                category_id: cats[0]?.id || '',
                description: '',
                linked_product_id: '',
                is_available: true,
                is_daily_menu: false,
                is_weekend_promo: false,
                promo_price: '',
                image_url: '',
              });
              setItemModal(true);
            }}
          >
            <Plus size={16} /> Plat
          </button>
        </div>
      </div>

      {msg && (
        <div className="card p-3 text-sm text-amber-700 dark:text-amber-300 flex justify-between">
          <span>{msg}</span>
          <button type="button" onClick={() => setMsg(null)}>
            ×
          </button>
        </div>
      )}

      {cats.length === 0 && items.length === 0 && (
        <EmptyState icon={<Plus size={40} />} title="Carte vide" message="Ajoutez une catégorie puis des plats." />
      )}

      {cats.map((cat) => {
        const catItems = items.filter((i) => i.category_id === cat.id);
        return (
          <section key={cat.id} className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-stone-800 dark:text-stone-100">{cat.name}</h2>
              <div className="flex gap-1">
                <button
                  type="button"
                  className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800"
                  onClick={() => {
                    setEditCat(cat);
                    setCatName(cat.name);
                    setCatModal(true);
                  }}
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                  onClick={async () => {
                    if (!confirm(`Supprimer la catégorie « ${cat.name} » ?`)) return;
                    await deleteCategory(cat.id);
                    await load();
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            {catItems.length === 0 && <p className="text-xs text-stone-400">Aucun plat</p>}
            <ul className="space-y-2">
              {catItems.map((it) => {
                const meta = parseMenuItemMeta(it);
                return (
                  <li
                    key={it.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-stone-200 dark:border-stone-700 px-3 py-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {it.image_url && (
                        <img
                          src={it.image_url}
                          alt={it.name}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-lg object-cover shrink-0 bg-stone-800"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium text-stone-900 dark:text-stone-100 truncate">
                          {it.name}{' '}
                          {!it.is_available && (
                            <span className="text-xs text-red-500 font-normal">· indisponible</span>
                          )}
                        </div>
                        <div className="text-xs text-stone-500 flex flex-wrap items-center gap-x-2">
                          <span className="font-semibold text-amber-500">
                            {meta.isWeekendPromo && meta.promoPrice
                              ? `${formatFCFA(meta.promoPrice)} (au lieu de ${formatFCFA(it.price)})`
                              : formatFCFA(it.price)}
                          </span>
                          {meta.isDailyMenu && <span className="text-emerald-500 font-semibold">· Menu du jour</span>}
                          {meta.isWeekendPromo && <span className="text-orange-500 font-semibold">· Promo Week-end</span>}
                          {it.linked_product_id && <span>· lié au stock</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        className="text-xs px-2 py-1 rounded-lg bg-stone-100 dark:bg-stone-800"
                        onClick={() => openOptions(it)}
                      >
                        Options
                      </button>
                      <button
                        type="button"
                        className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800"
                        onClick={() => {
                          setEditItem(it);
                          setForm({
                            name: it.name,
                            price: String(it.price),
                            category_id: it.category_id || '',
                            description: meta.cleanDescription,
                            linked_product_id: it.linked_product_id || '',
                            is_available: it.is_available,
                            is_daily_menu: meta.isDailyMenu,
                            is_weekend_promo: meta.isWeekendPromo,
                            promo_price: meta.promoPrice ? String(meta.promoPrice) : '',
                            image_url: it.image_url || '',
                          });
                          setItemModal(true);
                        }}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                        onClick={async () => {
                          if (!confirm(`Supprimer « ${it.name} » ?`)) return;
                          await deleteMenuItem(it.id);
                          await load();
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {items.filter((i) => !i.category_id).length > 0 && (
        <section className="card p-4 space-y-2">
          <h2 className="font-semibold">Sans catégorie</h2>
          {items
            .filter((i) => !i.category_id)
            .map((it) => (
              <div key={it.id} className="text-sm flex justify-between">
                <span>{it.name}</span>
                <span>{formatFCFA(it.price)}</span>
              </div>
            ))}
        </section>
      )}

      <Modal open={catModal} onClose={() => setCatModal(false)} title={editCat ? 'Modifier catégorie' : 'Nouvelle catégorie'}>
        <div className="space-y-3">
          <input
            className="input w-full"
            placeholder="Ex. Entrées, Plats, Desserts…"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
          />
          <button type="button" className="btn-primary w-full" disabled={busy} onClick={saveCat}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Enregistrer
          </button>
        </div>
      </Modal>

      <Modal open={itemModal} onClose={() => setItemModal(false)} title={editItem ? 'Modifier le plat' : 'Nouveau plat'}>
        <div className="space-y-3 max-h-[76vh] overflow-y-auto pr-1">
          <input
            className="input-field w-full"
            placeholder="Nom du plat"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input-field w-full"
              type="number"
              placeholder="Prix normal (FCFA)"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            />
            <select
              className="input-field w-full"
              value={form.category_id}
              onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
            >
              <option value="">Sans catégorie</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <textarea
            className="input-field w-full min-h-[68px]"
            placeholder="Description / accompagnements (optionnel)"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <div className="rounded-xl border border-stone-700/60 p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.is_daily_menu}
                onChange={(e) => setForm((f) => ({ ...f, is_daily_menu: e.target.checked }))}
              />
              Mettre en avant dans « Menu du jour »
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.is_weekend_promo}
                onChange={(e) => setForm((f) => ({ ...f, is_weekend_promo: e.target.checked }))}
              />
              Activer « Promo Week-end »
            </label>
            {form.is_weekend_promo && (
              <input
                className="input-field w-full text-sm"
                type="number"
                placeholder="Tarif promo week-end (FCFA, optionnel)"
                value={form.promo_price}
                onChange={(e) => setForm((f) => ({ ...f, promo_price: e.target.value }))}
              />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handlePhotoUpload(file);
              }}
            />
            <button
              type="button"
              disabled={uploadingPhoto}
              onClick={() => fileRef.current?.click()}
              className="btn-secondary text-xs inline-flex items-center gap-1.5"
            >
              <Camera size={14} /> {uploadingPhoto ? 'Envoi…' : 'Photo du plat'}
            </button>
            <input
              className="input-field flex-1 min-w-[160px] text-xs"
              placeholder="Ou URL photo (https://…)"
              value={form.image_url}
              onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
            />
          </div>
          <select
            className="input-field w-full"
            value={form.linked_product_id}
            onChange={(e) => setForm((f) => ({ ...f, linked_product_id: e.target.value }))}
          >
            <option value="">Pas de lien stock</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_available}
              onChange={(e) => setForm((f) => ({ ...f, is_available: e.target.checked }))}
            />
            Disponible à la carte
          </label>
          <button type="button" className="btn-primary w-full" disabled={busy} onClick={saveItem}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Enregistrer
          </button>
        </div>
      </Modal>

      <Modal open={!!optFor} onClose={() => setOptFor(null)} title={optFor ? `Options · ${optFor.name}` : 'Options'}>
        <div className="space-y-3">
          <ul className="space-y-1">
            {options.map((o) => (
              <li key={o.id} className="flex justify-between text-sm items-center">
                <span>
                  {o.name} (+{formatFCFA(o.price_delta)})
                </span>
                <button
                  type="button"
                  className="text-red-600 p-1"
                  onClick={async () => {
                    await deleteOption(o.id);
                    if (optFor) setOptions(await listOptions(optFor.id));
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="Option" value={optName} onChange={(e) => setOptName(e.target.value)} />
            <input
              className="input w-24"
              type="number"
              placeholder="+ FCFA"
              value={optDelta}
              onChange={(e) => setOptDelta(e.target.value)}
            />
            <button type="button" className="btn-primary" disabled={busy} onClick={addOpt}>
              <Plus size={16} />
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
