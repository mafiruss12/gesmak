import { useEffect, useState } from 'react';
import { Wallet, Plus, Trash2, TrendingDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useEstId } from '@/lib/useEstId';
import type { Expense, PaymentMethod } from '@/lib/types';
import { EXPENSE_CATEGORIES } from '@/lib/types';
import { formatFCFA, formatDate, todayISO } from '@/lib/format';
import { Modal, EmptyState, StatCard } from '@/components/ui';
import { cacheSet, fetchWithCache, isOnline, queueAdd } from '@/lib/offline';

export default function Expenses() {
  const { member } = useAuth();
  const estId = useEstId();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ category: 'Achats', description: '', amount: '', payment_method: 'cash', date: todayISO() });
  const [todayTotal, setTodayTotal] = useState(0);
  const [monthTotal, setMonthTotal] = useState(0);

  async function load() {
    if (!estId) { setLoading(false); return; }
    const cacheKey = `expenses:${estId}`;
    const { data } = await fetchWithCache<Expense[]>(cacheKey, async () => {
      const res = await supabase
        .from('expenses')
        .select('*')
        .eq('establishment_id', estId)
        .order('created_at', { ascending: false })
        .limit(50);
      return (res.data ?? []) as Expense[];
    });
    const list = data ?? [];
    setExpenses(list);

    const today = todayISO();
    const monthStart = new Date(); monthStart.setDate(1);
    setTodayTotal(list.filter((e) => e.created_at >= today).reduce((s, e) => s + Number(e.amount), 0));
    setMonthTotal(list.filter((e) => e.created_at >= monthStart.toISOString()).reduce((s, e) => s + Number(e.amount), 0));
    setLoading(false);
  }

  useEffect(() => { void load(); }, [estId]);

  async function save() {
    if (!estId || !form.amount) return;
    const payload = {
      establishment_id: estId,
      category: form.category,
      description: form.description || null,
      amount: Number(form.amount),
      payment_method: form.payment_method as PaymentMethod,
      created_by: member.user_id,
      created_at: new Date(form.date).toISOString(),
    };
    if (isOnline()) {
      await supabase.from('expenses').insert(payload);
      await load();
    } else {
      await queueAdd('expenses', 'insert', payload);
      const local: Expense = {
        id: `offline-${Date.now()}`,
        ...payload,
        description: payload.description,
      } as Expense;
      const next = [local, ...expenses];
      setExpenses(next);
      await cacheSet(`expenses:${estId}`, next);
      setTodayTotal((t) => t + Number(form.amount));
      setMonthTotal((t) => t + Number(form.amount));
    }
    setModalOpen(false);
    setForm({ category: 'Achats', description: '', amount: '', payment_method: 'cash', date: todayISO() });
  }

  async function remove(e: Expense) {
    if (!confirm('Supprimer cette dépense ?')) return;
    if (isOnline()) {
      await supabase.from('expenses').delete().eq('id', e.id);
      await load();
    } else {
      await queueAdd('expenses', 'delete', {}, { id: e.id });
      setExpenses((prev) => prev.filter((x) => x.id !== e.id));
    }
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-stone-400">Chargement...</div>;
  if (!estId) return <EmptyState icon={<Wallet size={48} />} title="Aucun établissement" message="Vous n'êtes rattaché à aucun établissement." />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100">Dépenses</h1>
          <p className="text-stone-400 text-sm">Suivez toutes vos dépenses</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2"><Plus size={18} /> Nouvelle dépense</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <StatCard label="Dépenses du jour" value={formatFCFA(todayTotal)} icon={<TrendingDown size={24} />} accent="error" />
        <StatCard label="Dépenses du mois" value={formatFCFA(monthTotal)} icon={<Wallet size={24} />} accent="warning" />
      </div>

      {expenses.length === 0 ? (
        <EmptyState icon={<Wallet size={48} />} title="Aucune dépense" message="Enregistrez votre première dépense." />
      ) : (
        <div className="space-y-2">
          {expenses.map((e) => (
            <div key={e.id} className="card flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-error-500/10"><TrendingDown size={20} className="text-error-400" /></div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-stone-100">{e.category}</p>
                <p className="text-sm text-stone-400 truncate">{e.description ?? '—'} · {formatDate(e.created_at)}</p>
              </div>
              <span className="font-semibold text-error-400">{formatFCFA(e.amount)}</span>
              <button onClick={() => remove(e)} className="p-2 rounded-lg hover:bg-error-500/10 text-stone-400 hover:text-error-400"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouvelle dépense">
        <div className="space-y-3">
          <div>
            <label className="label">Catégorie</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-field">
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Description</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field" placeholder="Détails..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Montant (FCFA)</label>
              <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="label">Paiement</label>
              <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className="input-field">
                <option value="cash">Espèces</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="other">Autre</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-field" />
          </div>
          <button onClick={save} className="btn-primary w-full">Enregistrer</button>
        </div>
      </Modal>
    </div>
  );
}
