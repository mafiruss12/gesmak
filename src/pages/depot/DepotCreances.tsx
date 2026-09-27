import { useCallback, useEffect, useState } from 'react';
import { Wallet, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { listReceivables } from '@/lib/depot';
import { formatFCFA } from '@/lib/format';
import { EmptyState, Badge } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export default function DepotCreances() {
  const { member, activeEstablishment } = useAuth();
  const depotId = activeEstablishment?.id || member?.establishment_id || null;
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!depotId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setRows(await listReceivables(depotId));
    setLoading(false);
  }, [depotId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markPaid(id: string, total: number) {
    if (!confirm('Marquer comme entièrement payé ?')) return;
    await supabase
      .from('depot_deliveries')
      .update({ paid_amount: total, payment_method: 'credit_settled', updated_at: new Date().toISOString() })
      .eq('id', id);
    await load();
  }

  if (loading) {
    return (
      <div className="flex gap-2 p-6 text-stone-400">
        <Loader2 className="animate-spin" /> Chargement…
      </div>
    );
  }

  const totalDue = rows.reduce((s, r) => s + (Number(r.total_amount || 0) - Number(r.paid_amount || 0)), 0);

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-24">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <Wallet size={22} /> Créances
      </h1>
      <p className="text-sm text-stone-500">
        Impayés : <strong className="text-amber-400">{formatFCFA(totalDue)}</strong>
      </p>
      {rows.length === 0 ? (
        <EmptyState icon={<Wallet size={40} />} title="Aucune créance" message="Les livraisons à crédit non soldées apparaîtront ici." />
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const due = Number(r.total_amount || 0) - Number(r.paid_amount || 0);
            return (
              <li key={r.id} className="card p-3 flex justify-between gap-2 items-start">
                <div>
                  <div className="font-medium">{r.depot_clients?.name || 'Client'}</div>
                  <div className="text-xs text-stone-500">
                    {r.delivery_date || r.created_at?.slice(0, 10)} · payé {formatFCFA(Number(r.paid_amount || 0))}
                  </div>
                  <Badge color="warning">Reste {formatFCFA(due)}</Badge>
                </div>
                <button type="button" className="text-sm text-emerald-500" onClick={() => void markPaid(r.id, Number(r.total_amount || 0))}>
                  Soldé
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
