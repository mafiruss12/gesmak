import { useEffect, useState } from 'react';
import { ClipboardCheck, Calendar, TrendingUp, TrendingDown, Lock, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { DailyReport as Report } from '@/lib/types';
import { formatFCFA, formatDate } from '@/lib/format';
import { EmptyState, Badge } from '@/components/ui';

export default function Reports() {
  const { member } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!member?.establishment_id) { setLoading(false); return; }
    const { data } = await supabase.from('daily_reports').select('*').eq('establishment_id', member.establishment_id).order('date', { ascending: false }).limit(30);
    setReports((data ?? []) as Report[]);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [member]);

  function exportCSV() {
    const headers = ['Date', 'Ventes', 'Dépenses', 'Espèces', 'Mobile Money', 'Pertes', 'Casse', 'Bénéfice', 'Statut'];
    const rows = reports.map((r) => [
      r.date,
      r.total_sales,
      r.total_expenses,
      r.cash,
      r.mobile_money,
      r.losses,
      r.broken,
      r.total_sales - r.total_expenses - r.losses - r.broken,
      r.locked ? 'Verrouillé' : 'En cours',
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapports_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-stone-400">Chargement...</div>;
  if (!member?.establishment_id) return <EmptyState icon={<ClipboardCheck size={48} />} title="Aucun établissement" message="Vous n'êtes rattaché à aucun établissement." />;

  const totalSales = reports.reduce((s, r) => s + r.total_sales, 0);
  const totalExpenses = reports.reduce((s, r) => s + r.total_expenses + r.losses + r.broken, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100">Rapports</h1>
          <p className="text-stone-400 text-sm">{reports.length} rapports · CA total: {formatFCFA(totalSales)}</p>
        </div>
        {reports.length > 0 && (
          <button onClick={exportCSV} className="btn-secondary flex items-center gap-2"><Download size={18} /> Exporter CSV</button>
        )}
      </div>

      {reports.length === 0 ? (
        <EmptyState icon={<ClipboardCheck size={48} />} title="Aucun rapport" message="Les clôtures quotidiennes apparaîtront ici." />
      ) : (
        <div className="space-y-2">
          {reports.map((r) => {
            const profit = r.total_sales - r.total_expenses - r.losses - r.broken;
            return (
              <div key={r.id} className="card flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-stone-800"><Calendar size={20} className="text-stone-400" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-stone-100 capitalize">{formatDate(r.date)}</p>
                    {r.locked ? <Badge color="success"><Lock size={10} className="inline" /> Verrouillé</Badge> : <Badge color="warning">En cours</Badge>}
                  </div>
                  <p className="text-sm text-stone-400">
                    Ventes: {formatFCFA(r.total_sales)} · Dépenses: {formatFCFA(r.total_expenses)}
                    {r.losses > 0 && ` · Pertes: ${formatFCFA(r.losses)}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-stone-400">Bénéfice</p>
                  <p className={`font-bold flex items-center gap-1 ${profit >= 0 ? 'text-success-400' : 'text-error-400'}`}>
                    {profit >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {formatFCFA(profit)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
