import { useEffect, useState } from 'react';
import { Truck, Loader2, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { EmptyState, Modal } from '@/components/ui';
import { RENTAL_STATUS_LABELS } from '@/lib/businessTypes';
import { notifyTeam, clientWhatsAppUrl } from '@/lib/rentalNotify';
import type { RentalOrder, RentalOrderItem, RentalEquipment } from '@/lib/rentalTypes';

export default function RentMovements() {
  const { member, activeEstablishment } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const [orders, setOrders] = useState<RentalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<RentalOrder | null>(null);
  const [mode, setMode] = useState<'out' | 'return'>('out');
  const [responsible, setResponsible] = useState('');
  const [saving, setSaving] = useState(false);
  const [wa, setWa] = useState<string | null>(null);

  async function load() {
    if (!estId) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('rental_orders')
      .select('*')
      .eq('establishment_id', estId)
      .in('status', ['confirmed', 'out'])
      .order('event_date');
    setOrders((data ?? []) as RentalOrder[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estId]);

  async function processMovement() {
    if (!selected || !estId) return;
    setSaving(true);
    setWa(null);

    const { data: items } = await supabase
      .from('rental_order_items')
      .select('*')
      .eq('order_id', selected.id);
    const orderItems = (items ?? []) as RentalOrderItem[];

    await supabase.from('rental_movements').insert({
      establishment_id: estId,
      order_id: selected.id,
      type: mode,
      responsible: responsible || null,
      items: orderItems,
    });

    for (const it of orderItems) {
      if (!it.equipment_id) continue;
      const { data: eq } = await supabase
        .from('rental_equipment')
        .select('*')
        .eq('id', it.equipment_id)
        .maybeSingle();
      if (!eq) continue;
      const e = eq as RentalEquipment;
      if (mode === 'out') {
        await supabase
          .from('rental_equipment')
          .update({
            qty_reserved: Math.max(0, e.qty_reserved - it.qty),
            qty_out: e.qty_out + it.qty,
          })
          .eq('id', e.id);
      } else {
        await supabase
          .from('rental_equipment')
          .update({
            qty_out: Math.max(0, e.qty_out - it.qty),
            qty_available: e.qty_available + it.qty,
          })
          .eq('id', e.id);
      }
    }

    const newStatus = mode === 'out' ? 'out' : 'returned';
    await supabase.from('rental_orders').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', selected.id);

    await notifyTeam(
      estId,
      mode === 'out' ? 'Sortie matériel' : 'Retour matériel',
      `${selected.client_name || 'Client'} — commande ${selected.id.slice(0, 8)}`,
      '/rent/movements'
    );

    setWa(
      clientWhatsAppUrl(
        selected.client_phone,
        `#${selected.id.slice(0, 8)}`,
        mode === 'out'
          ? `Votre matériel a été livré / sorti. Bon événement !`
          : `Retour enregistré. Merci pour votre confiance.`
      )
    );

    setSaving(false);
    setSelected(null);
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
      <h1 className="text-2xl font-bold font-display text-stone-100 mb-1">Sorties & retours</h1>
      <p className="text-stone-400 text-sm mb-6">Livraison et récupération du matériel</p>

      {wa && (
        <a href={wa} target="_blank" rel="noreferrer" className="card mb-4 block text-success-400 text-sm">
          Ouvrir WhatsApp pour informer le client →
        </a>
      )}

      {orders.length === 0 ? (
        <EmptyState icon={<Truck size={48} />} title="Rien en attente" message="Aucune commande confirmée ou en sortie." />
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <div key={o.id} className="card flex flex-wrap items-center gap-3">
              <div className="flex-1">
                <p className="font-medium text-stone-100">{o.client_name || 'Client'}</p>
                <p className="text-xs text-stone-500">
                  {RENTAL_STATUS_LABELS[o.status]} · Événement {o.event_date || '—'}
                </p>
              </div>
              {o.status === 'confirmed' && (
                <button
                  className="btn-primary text-sm flex items-center gap-1"
                  onClick={() => {
                    setSelected(o);
                    setMode('out');
                  }}
                >
                  <ArrowUpFromLine size={14} /> Sortie
                </button>
              )}
              {o.status === 'out' && (
                <button
                  className="btn-secondary text-sm flex items-center gap-1"
                  onClick={() => {
                    setSelected(o);
                    setMode('return');
                  }}
                >
                  <ArrowDownToLine size={14} /> Retour
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={mode === 'out' ? 'Enregistrer la sortie' : 'Enregistrer le retour'}
      >
        <div className="space-y-3">
          <p className="text-sm text-stone-400">{selected?.client_name}</p>
          <div>
            <label className="label">Responsable</label>
            <input className="input-field" value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="Nom livreur / équipe" />
          </div>
          <button onClick={processMovement} disabled={saving} className="btn-primary w-full">
            {saving ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Valider'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
