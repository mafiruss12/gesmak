import { useEffect, useState } from 'react';
import { Plus, Trash2, Package, Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { BTP_CATEGORIES, formatMoney } from '@/lib/btp';

export default function BtpMaterials() {
  const { member, activeEstablishment } = useAuth();
  const est = activeEstablishment?.id || member?.establishment_id;
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    id: '',
    name: '',
    category: 'divers',
    unit: 'u',
    default_price: 0,
    default_tax_rate: 0,
    description: '',
  });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catFilter, setCatFilter] = useState('all');

  async function load() {
    if (!est) return;
    setLoading(true);
    const { data } = await supabase.from('btp_materials').select('*').eq('establishment_id', est).order('name');
    setList(data || []);
    setLoading(false);
  }
  useEffect(() => { void load(); }, [est]);

  function startNew() {
    setForm({ id: '', name: '', category: 'divers', unit: 'u', default_price: 0, default_tax_rate: 0, description: '' });
    setOpen(true);
    setError(null);
  }
  function startEdit(m: any) {
    setForm({
      id: m.id,
      name: m.name || '',
      category: m.category || 'divers',
      unit: m.unit || 'u',
      default_price: Number(m.default_price) || 0,
      default_tax_rate: Number(m.default_tax_rate) || 0,
      description: m.description || '',
    });
    setOpen(true);
  }

  async function save() {
    if (!est || !form.name.trim()) {
      setError('Le nom est obligatoire');
      return;
    }
    const payload = {
      establishment_id: est,
      name: form.name.trim(),
      category: form.category,
      unit: form.unit || 'u',
      default_price: Number(form.default_price) || 0,
      default_tax_rate: Number(form.default_tax_rate) || 0,
      description: form.description.trim() || null,
    };
    if (form.id) {
      const { error: e } = await supabase.from('btp_materials').update(payload).eq('id', form.id);
      if (e) { setError(e.message); return; }
    } else {
      const { error: e } = await supabase.from('btp_materials').insert(payload);
      if (e) { setError(e.message); return; }
    }
    setOpen(false);
    await load();
  }

  async function remove(id: string) {
    if (!confirm('Supprimer ce matériau ?')) return;
    await supabase.from('btp_materials').delete().eq('id', id);
    await load();
  }

  async function seedDefaults() {
    if (!est) return;
    const seeds = [
      { name: 'Ciment 50 kg', category: 'gros_oeuvre', unit: 'sac', default_price: 6500 },
      { name: 'Fer 8 mm', category: 'quincaillerie_fer', unit: 'barre', default_price: 3500 },
      { name: 'Sable', category: 'gros_oeuvre', unit: 'm³', default_price: 25000 },
      { name: 'Gravier', category: 'gros_oeuvre', unit: 'm³', default_price: 28000 },
      { name: 'Main d\'œuvre maçon / jour', category: 'main_oeuvre', unit: 'j', default_price: 15000 },
      { name: 'Peinture 20 L', category: 'peinture_revetement', unit: 'seau', default_price: 35000 },
    ];
    await supabase.from('btp_materials').insert(seeds.map((s) => ({ ...s, establishment_id: est, default_tax_rate: 0 })));
    await load();
  }

  const visible = catFilter === 'all' ? list : list.filter((m) => m.category === catFilter);
  const catLabel = (id: string) => BTP_CATEGORIES.find((c) => c.id === id)?.label || id;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-stone-100 flex items-center gap-2"><Package className="text-sky-400" /> Matériaux BTP</h1>
          <p className="text-sm text-stone-500">Catalogue prix unitaires</p>
        </div>
        <div className="flex gap-2">
          {list.length === 0 && (
            <button type="button" className="btn-secondary text-xs" onClick={() => void seedDefaults()}>Catalogue de base</button>
          )}
          <button type="button" className="btn-primary text-sm" onClick={startNew}><Plus size={16} /> Ajouter</button>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        <button type="button" onClick={() => setCatFilter('all')} className={`text-[11px] px-2 py-1 rounded-full whitespace-nowrap ${catFilter === 'all' ? 'bg-sky-500/20 text-sky-300' : 'bg-stone-800 text-stone-400'}`}>Tous</button>
        {BTP_CATEGORIES.map((c) => (
          <button key={c.id} type="button" onClick={() => setCatFilter(c.id)} className={`text-[11px] px-2 py-1 rounded-full whitespace-nowrap ${catFilter === c.id ? 'bg-sky-500/20 text-sky-300' : 'bg-stone-800 text-stone-400'}`}>{c.label}</button>
        ))}
      </div>
      {open && (
        <div className="card space-y-3">
          {error && <p className="text-sm text-red-300">{error}</p>}
          <input className="input-field" placeholder="Nom *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {BTP_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <div className="grid grid-cols-3 gap-2">
            <input className="input-field" placeholder="Unité" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            <input type="number" className="input-field" placeholder="Prix" value={form.default_price} onChange={(e) => setForm({ ...form, default_price: Number(e.target.value) })} />
            <input type="number" className="input-field" placeholder="TVA %" value={form.default_tax_rate} onChange={(e) => setForm({ ...form, default_tax_rate: Number(e.target.value) })} />
          </div>
          <textarea className="input-field min-h-[50px]" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex gap-2">
            <button type="button" className="btn-primary" onClick={() => void save()}>Enregistrer</button>
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
          </div>
        </div>
      )}
      {loading ? <p className="text-stone-500">Chargement…</p> : visible.length === 0 ? (
        <div className="card text-center py-8 text-stone-500">Aucun matériau</div>
      ) : (
        <ul className="space-y-2">
          {visible.map((m) => (
            <li key={m.id} className="card flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-stone-100">{m.name}</p>
                <p className="text-xs text-stone-500">{catLabel(m.category)} · {m.unit}</p>
                <p className="text-sm text-sky-400 font-semibold">{formatMoney(m.default_price)} / {m.unit}</p>
              </div>
              <button type="button" className="p-2 text-stone-400" onClick={() => startEdit(m)}><Pencil size={16} /></button>
              <button type="button" className="p-2 text-red-400" onClick={() => void remove(m.id)}><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
