import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Package, Award, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Sale } from '@/lib/types';
import { formatFCFA, daysAgoISO, formatNumber } from '@/lib/format';
import { StatCard, EmptyState } from '@/components/ui';

interface StatsData {
  totalSales: number;
  avgDaily: number;
  bestDay: { date: string; amount: number };
  topProducts: { name: string; qty: number; revenue: number }[];
  dailyData: { date: string; sales: number; expenses: number }[];
  totalTransactions: number;
  avgBasket: number;
}

export default function Statistics() {
  const { member } = useAuth();
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!member?.establishment_id) { setLoading(false); return; }
      const estId = member.establishment_id;
      const start = daysAgoISO(30);

      const [salesRes, expensesRes] = await Promise.all([
        supabase.from('sales').select('total, qty, product_id, created_at').eq('establishment_id', estId).gte('created_at', start),
        supabase.from('expenses').select('amount, created_at').eq('establishment_id', estId).gte('created_at', start),
      ]);

      const sales = (salesRes.data ?? []) as Sale[];
      const totalSales = sales.reduce((s, r) => s + Number(r.total), 0);
      const totalTransactions = sales.length;
      const avgBasket = totalTransactions > 0 ? totalSales / totalTransactions : 0;

      const dailyMap: Record<string, number> = {};
      const expenseMap: Record<string, number> = {};
      for (const s of sales) {
        const d = s.created_at.split('T')[0];
        dailyMap[d] = (dailyMap[d] ?? 0) + Number(s.total);
      }
      for (const e of (expensesRes.data ?? [])) {
        const d = (e.created_at as string).split('T')[0];
        expenseMap[d] = (expenseMap[d] ?? 0) + Number(e.amount);
      }

      const dailyData: { date: string; sales: number; expenses: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().split('T')[0];
        dailyData.push({ date: ds, sales: dailyMap[ds] ?? 0, expenses: expenseMap[ds] ?? 0 });
      }

      const bestDay = dailyData.reduce((best, d) => d.sales > best.amount ? { date: d.date, amount: d.sales } : best, { date: '', amount: 0 });
      const avgDaily = totalSales / 30;

      const prodMap: Record<string, { qty: number; revenue: number }> = {};
      for (const s of sales) {
        const key = s.product_id ?? 'unknown';
        if (!prodMap[key]) prodMap[key] = { qty: 0, revenue: 0 };
        prodMap[key].qty += Number(s.qty);
        prodMap[key].revenue += Number(s.total);
      }
      const productIds = Object.keys(prodMap).filter((k) => k !== 'unknown');
      const { data: prods } = await supabase.from('products').select('id, name').in('id', productIds);
      const prodNames: Record<string, string> = {};
      for (const p of (prods ?? [])) prodNames[p.id] = p.name;
      const topProducts = Object.entries(prodMap)
        .map(([id, v]) => ({ name: prodNames[id] ?? 'Produit supprimé', qty: v.qty, revenue: v.revenue }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      setData({ totalSales, avgDaily, bestDay, topProducts, dailyData, totalTransactions, avgBasket });
      setLoading(false);
    })();
  }, [member]);

  if (loading) return <div className="flex items-center justify-center py-20 text-stone-400">Chargement...</div>;
  if (!member?.establishment_id) return <EmptyState icon={<BarChart3 size={48} />} title="Aucun établissement" message="Vous n'êtes rattaché à aucun établissement." />;
  if (!data) return null;

  const maxSales = Math.max(...data.dailyData.map((d) => d.sales), 1);
  const maxExp = Math.max(...data.dailyData.map((d) => d.expenses), 1);
  const maxBar = Math.max(maxSales, maxExp);

  return (
    <div>
      <h1 className="text-2xl font-bold font-display text-stone-100 mb-2">Statistiques</h1>
      <p className="text-stone-400 text-sm mb-6">Analyse sur 30 jours</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Ventes (30j)" value={formatFCFA(data.totalSales)} icon={<TrendingUp size={24} />} accent="success" />
        <StatCard label="Moyenne / jour" value={formatFCFA(data.avgDaily)} icon={<Calendar size={24} />} accent="primary" />
        <StatCard label="Transactions" value={formatNumber(data.totalTransactions)} icon={<BarChart3 size={24} />} accent="secondary" />
        <StatCard label="Panier moyen" value={formatFCFA(data.avgBasket)} icon={<Package size={24} />} accent="warning" />
      </div>

      {data.bestDay.amount > 0 && (
        <div className="card mb-6 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-success-500/10"><Award size={24} className="text-success-400" /></div>
          <div>
            <p className="text-sm text-stone-400">Meilleur jour</p>
            <p className="text-lg font-bold text-stone-100">
              {new Date(data.bestDay.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <span className="ml-auto text-2xl font-bold text-success-400">{formatFCFA(data.bestDay.amount)}</span>
        </div>
      )}

      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-stone-100 mb-5">Ventes vs Dépenses (30 jours)</h2>
        <div className="flex items-end justify-between gap-1 h-48">
          {data.dailyData.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div className="w-full flex-1 flex items-end gap-0.5">
                <div className="flex-1 bg-gradient-to-t from-success-600 to-success-400 rounded-t min-h-[2px] relative group-hover:from-success-500 group-hover:to-success-300 transition-all" style={{ height: `${(d.sales / maxBar) * 100}%` }}>
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-stone-300 opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity">{formatFCFA(d.sales)}</span>
                </div>
                <div className="flex-1 bg-gradient-to-t from-error-600 to-error-400 rounded-t min-h-[2px]" style={{ height: `${(d.expenses / maxBar) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-4 text-xs text-stone-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-success-500 rounded" /> Ventes</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-error-500 rounded" /> Dépenses</span>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-stone-100 mb-4">Top 5 produits</h2>
        {data.topProducts.length === 0 ? (
          <p className="text-sm text-stone-500">Aucune vente sur cette période</p>
        ) : (
          <div className="space-y-3">
            {data.topProducts.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-primary-500/20 text-primary-300 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <span className="flex-1 text-stone-200 truncate">{p.name}</span>
                <span className="text-sm text-stone-400">{formatNumber(p.qty)} vendus</span>
                <span className="font-bold text-success-400 w-28 text-right">{formatFCFA(p.revenue)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
