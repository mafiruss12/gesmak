import { useEffect, useState } from 'react';
import { ShoppingCart, Plus, Trash2, Package, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Purchase, Supplier, Product } from '@/lib/types';
import { formatFCFA, formatDateTime } from '@/lib/format';
import { Modal, EmptyState, Badge, StatCard } from '@/components/ui';

export default function Purchases() {
  const { member } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ supplier_id: '', product_id: '', qty: '', unit_cost: '', notes: '' });
  const [monthTotal, setMonthTotal] = useState(0);

  async function load() {
    if (!member?.establishment_id) { setLoading(false); return; }
    const [purRes, supRes, prodRes, monthRes] = await Promise.all([
      supabase.from('purchases').select('*').eq('establishment_id', member.establishment_id).order('created_at', { ascending: false }).limit(50),
      supabase.from('suppliers').select('*').eq('establishment_id', member.establishment_id).order('name'),
      supabase.from('products').select('*').eq('establishment_id', member.establishment_id).order('name'),
      supabase.from('purchases').select('total').eq('establishment_id', member.establishment_id).gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    ]);
    setPurchases((purRes.data ?? []) as Purchase[]);
    setSuppliers((supRes.data ?? []) as Supplier[]);
    setProducts((prodRes.data ?? []) as Product[]);
    setMonthTotal((monthRes.data ?? []).reduce((s, p) => s + Number(p.total), 0));
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [member]);

  async function save() {
    if (!member?.establishment_id || !form.product_id || !form.qty) return;
    const qty = Number(form.qty);
    const unitCost = Number(form.unit_cost) || 0;
    const total = qty * unitCost;
    const { data } = await supabase.from('purchases').insert({
      establishment_id: member.establishment_id,
      supplier_id: form.supplier_id || null,
      product_id: form.product_id,
      qty, unit_cost: unitCost, total,
      status: 'received',
      notes: form.notes || null,
      created_by: member.user_id,
    }).select().single();
    if (data) {
      const prod = products.find((p) => p.id === form.product_id);
      if (prod) {
        await supabase.from('products').update({ stock: prod.stock + qty, cost: unitCost || prod.cost }).eq('id', prod.id);
      }
    }
    setModalOpen(false);
    setForm({ supplier_id: '', product_id: '', qty: '', unit_cost: '', notes: '' });
    await load();
  }

  async function remove(p: Purchase) {
    if (!confirm('Supprimer cet achat ?')) return;
    await supabase.from('purchases').delete().eq('id', p.id);
    await load();
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-stone-400">Chargement...</div>;
  if (!member?.establishment_id) return <EmptyState icon={<ShoppingCart size={48} />} title="Aucun établissement" message="Vous n'êtes rattaché à aucun établissement." />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100">Achats</h1>
          <p className="text-stone-400 text-sm">Réapprovisionnement de stock</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2"><Plus size={18} /> Nouvel achat</button>
      </div>

      <div className="mb-6">
        <StatCard label="Achats du mois" value={formatFCFA(monthTotal)} icon={<ShoppingCart size={24} />} accent="secondary" />
      </div>

      {purchases.length === 0 ? (
        <EmptyState icon={<ShoppingCart size={48} />} title="Aucun achat" message="Enregistrez votre premier achat." />
      ) : (
        <div className="space-y-2">
          {purchases.map((p) => {
            const prod = products.find((x) => x.id === p.product_id);
            const sup = suppliers.find((x) => x.id === p.supplier_id);
            const statusIcon = p.status === 'received' ? <CheckCircle2 size={14} className="text-success-400" /> : p.status === 'cancelled' ? <XCircle size={14} className="text-error-400" /> : <Clock size={14} className="text-warning-400" />;
            return (
              <div key={p.id} className="card flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-secondary-500/10"><Package size={20} className="text-secondary-400" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-stone-100">{prod?.name ?? 'Produit supprimé'}</p>
                  <p className="text-sm text-stone-400 truncate">
                    {p.qty} unités · {sup?.name ?? 'Sans fournisseur'} · {formatDateTime(p.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {statusIcon}
                  <Badge color={p.status === 'received' ? 'success' : p.status === 'cancelled' ? 'error' : 'warning'}>
                    {p.status === 'received' ? 'Reçu' : p.status === 'cancelled' ? 'Annulé' : 'Commandé'}
                  </Badge>
                </div>
                <span className="font-semibold text-stone-200">{formatFCFA(p.total)}</span>
                <button onClick={() => remove(p)} className="p-2 rounded-lg hover:bg-error-500/10 text-stone-400 hover:text-error-400"><Trash2 size={16} /></button>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouvel achat">
        <div className="space-y-3">
          <div>
            <label className="label">Produit</label>
            <select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} className="input-field">
              <option value="">— Choisir —</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} (stock: {p.stock})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Fournisseur</label>
            <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} className="input-field">
              <option value="">— Sans fournisseur —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Quantité</label>
              <input type="number" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="label">Coût unitaire (FCFA)</label>
              <input type="number" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} className="input-field" />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input-field" placeholder="Détails..." />
          </div>
          <div className="bg-stone-800/50 rounded-xl p-3 text-sm text-stone-300 flex justify-between">
            <span>Total</span>
            <span className="font-bold text-primary-400">{formatFCFA((Number(form.qty) || 0) * (Number(form.unit_cost) || 0))}</span>
          </div>
          <button onClick={save} className="btn-primary w-full">Enregistrer l'achat</button>
        </div>
      </Modal>
    </div>
  );
}
