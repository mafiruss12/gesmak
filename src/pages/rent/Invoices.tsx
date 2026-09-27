import { useEffect, useState } from 'react';
import { FileText, Loader2, Printer } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { formatFCFA } from '@/lib/format';
import { EmptyState } from '@/components/ui';
import { RENTAL_STATUS_LABELS } from '@/lib/businessTypes';
import type { RentalOrder, RentalOrderItem } from '@/lib/rentalTypes';
import { orderBalance } from '@/lib/rentalTypes';

type DocMode = 'facture' | 'devis';

export default function RentInvoices() {
  const { member, activeEstablishment } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const [orders, setOrders] = useState<RentalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<{ order: RentalOrder; items: RentalOrderItem[]; mode: DocMode } | null>(null);

  useEffect(() => {
    (async () => {
      if (!estId) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('rental_orders')
        .select('*')
        .eq('establishment_id', estId)
        .order('created_at', { ascending: false });
      setOrders((data ?? []) as RentalOrder[]);
      setLoading(false);
    })();
  }, [estId]);

  async function openDoc(o: RentalOrder, mode: DocMode) {
    const { data } = await supabase.from('rental_order_items').select('*').eq('order_id', o.id);
    setDetail({ order: o, items: (data ?? []) as RentalOrderItem[], mode });
  }

  function printDoc() {
    window.print();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary-500" size={28} />
      </div>
    );
  }

  if (detail) {
    const { order, items, mode } = detail;
    const title = mode === 'devis' ? 'DEVIS' : 'FACTURE / REÇU';
    const caution = Number((order as any).caution_amount || 0);
    return (
      <div>
        <div className="flex flex-wrap gap-2 mb-4 print:hidden">
          <button type="button" className="btn-secondary" onClick={() => setDetail(null)}>
            Retour
          </button>
          <button type="button" className="btn-primary flex items-center gap-2" onClick={printDoc}>
            <Printer size={16} /> Imprimer / PDF
          </button>
        </div>
        <div className="card max-w-lg mx-auto bg-white text-stone-900 print:shadow-none print:border-0">
          <h1 className="text-xl font-bold">{activeEstablishment?.name || 'Location'}</h1>
          <p className="text-sm text-stone-600 mb-1">{title}</p>
          <p className="text-xs text-stone-500 mb-4">N° {order.id.slice(0, 8).toUpperCase()}</p>
          <p>
            <strong>Client :</strong> {order.client_name || '—'}
          </p>
          <p>
            <strong>Tél :</strong> {order.client_phone || '—'}
          </p>
          <p>
            <strong>Événement :</strong> {order.event_date || '—'}
          </p>
          <p>
            <strong>Retour :</strong> {order.return_date || '—'}
          </p>
          <p>
            <strong>Statut :</strong> {RENTAL_STATUS_LABELS[order.status] || order.status}
          </p>
          <table className="w-full text-sm mt-4 border-t">
            <thead>
              <tr className="text-left">
                <th className="py-2">Article</th>
                <th>Qté</th>
                <th>P.U.</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t border-stone-200">
                  <td className="py-1">{it.equipment_name}</td>
                  <td>{it.qty}</td>
                  <td>{formatFCFA(Number(it.unit_price))}</td>
                  <td>{formatFCFA(Number(it.line_total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 text-right space-y-1 text-sm">
            <p>
              <strong>Total :</strong> {formatFCFA(Number(order.total_amount))}
            </p>
            <p>Acompte : {formatFCFA(Number(order.deposit_amount))}</p>
            <p>Payé : {formatFCFA(Number(order.paid_amount))}</p>
            <p>
              <strong>Solde :</strong> {formatFCFA(orderBalance(order))}
            </p>
            {caution > 0 && (
              <p className="text-amber-700">
                Caution : {formatFCFA(caution)}
                {(order as any).caution_returned ? ' (restituée)' : ' (à restituer au retour)'}
              </p>
            )}
          </div>
          {mode === 'devis' && (
            <p className="text-xs text-stone-500 mt-4 border-t pt-2">
              Devis valable 7 jours. Sous réserve de disponibilité du matériel aux dates indiquées.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold font-display text-stone-100 mb-1">Factures & Devis</h1>
      <p className="text-stone-400 text-sm mb-6">Imprimer ou enregistrer en PDF</p>

      {orders.length === 0 ? (
        <EmptyState icon={<FileText size={48} />} title="Aucun document" message="Créez une commande pour générer devis / facture." />
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <div key={o.id} className="card flex flex-wrap items-center gap-2 justify-between">
              <div>
                <p className="font-medium text-stone-100">{o.client_name || 'Client'}</p>
                <p className="text-xs text-stone-500">
                  {o.event_date || '—'} · {RENTAL_STATUS_LABELS[o.status] || o.status} · {formatFCFA(Number(o.total_amount))}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary text-xs py-2 px-3" onClick={() => openDoc(o, 'devis')}>
                  Devis
                </button>
                <button type="button" className="btn-primary text-xs py-2 px-3" onClick={() => openDoc(o, 'facture')}>
                  Facture
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
