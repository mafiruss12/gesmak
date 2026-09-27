import { useEffect, useState } from 'react';
import { Wallet, Loader2, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { formatFCFA, formatDateTime } from '@/lib/format';
import { EmptyState, Modal } from '@/components/ui';
import type { RentalOrder, RentalPayment } from '@/lib/rentalTypes';
import { orderBalance } from '@/lib/rentalTypes';
import { notifyTeam } from '@/lib/rentalNotify';

export default function RentPayments() {
  const { member, activeEstablishment } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const [orders, setOrders] = useState<RentalOrder[]>([]);
  const [payments, setPayments] = useState<RentalPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [amount, setAmount] = useState(0);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!estId) {
      setLoading(false);
      return;
    }
    const est = estId;
    const [o, p] = await Promise.all([
      supabase.from('rental_orders').select('*').eq('establishment_id', est).order('created_at', { ascending: false }),
      supabase.from('rental_payments').select('*').eq('establishment_id', est).order('created_at', { ascending: false }).limit(50),
    ]);
    setOrders((o.data ?? []) as RentalOrder[]);
    setPayments((p.data ?? []) as RentalPayment[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estId]);

  const unpaid = orders.filter((o) => orderBalance(o) > 0 && o.status !== 'cancelled');

  async function addPayment() {
    if (!estId || !orderId || amount <= 0) return;
    setSaving(true);
    const order = orders.find((o) => o.id === orderId);
    await supabase.from('rental_payments').insert({
      establishment_id: estId,
      order_id: orderId,
      amount,
      method: 'cash',
    });
    if (order) {
      await supabase
        .from('rental_orders')
        .update({ paid_amount: Number(order.paid_amount) + amount })
        .eq('id', orderId);
      await notifyTeam(
        estId,
        'Paiement reçu',
        `${order.client_name || 'Client'} — ${formatFCFA(amount)}`,
        '/rent/payments'
      );
    }
    setSaving(false);
    setOpen(false);
    setAmount(0);
    await load();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary-500" size={28} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100">Paiements</h1>
          <p className="text-stone-400 text-sm">{unpaid.length} commande(s) avec solde</p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Enregistrer
        </button>
      </div>

      <h2 className="text-sm font-semibold text-stone-400 mb-2">Impayés</h2>
      {unpaid.length === 0 ? (
        <p className="text-stone-500 text-sm mb-6">Aucun solde en attente.</p>
      ) : (
        <div className="space-y-2 mb-8">
          {unpaid.map((o) => (
            <div key={o.id} className="card flex justify-between text-sm">
              <span className="text-stone-200">{o.client_name || 'Client'}</span>
              <span className="text-amber-400 font-medium">{formatFCFA(orderBalance(o))}</span>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-sm font-semibold text-stone-400 mb-2">Historique</h2>
      {payments.length === 0 ? (
        <EmptyState icon={<Wallet size={48} />} title="Aucun paiement" message="" />
      ) : (
        <div className="space-y-2">
          {payments.map((p) => (
            <div key={p.id} className="card flex justify-between text-sm">
              <span className="text-stone-400">{formatDateTime(p.created_at)}</span>
              <span className="text-success-400 font-medium">+{formatFCFA(Number(p.amount))}</span>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nouveau paiement">
        <div className="space-y-3">
          <div>
            <label className="label">Commande</label>
            <select className="input-field" value={orderId} onChange={(e) => setOrderId(e.target.value)}>
              <option value="">—</option>
              {unpaid.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.client_name} — solde {formatFCFA(orderBalance(o))}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Montant</label>
            <input type="number" min={0} className="input-field" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <button onClick={addPayment} disabled={saving} className="btn-primary w-full">
            {saving ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Valider'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
