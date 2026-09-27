import { useEffect, useState } from 'react';
import { ClipboardList, Plus, Loader2, MessageCircle, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { formatFCFA } from '@/lib/format';
import { EmptyState, Modal, Badge } from '@/components/ui';
import { RENTAL_STATUS_LABELS, buildWhatsAppLink } from '@/lib/businessTypes';
import { notifyTeam, clientWhatsAppUrl } from '@/lib/rentalNotify';
import type { RentalClient, RentalEquipment, RentalOrder, RentalOrderItem } from '@/lib/rentalTypes';
import { orderBalance } from '@/lib/rentalTypes';

export default function RentOrders() {
  const { member, user, activeEstablishment } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const [orders, setOrders] = useState<RentalOrder[]>([]);
  const [clients, setClients] = useState<RentalClient[]>([]);
  const [equipment, setEquipment] = useState<RentalEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waLink, setWaLink] = useState<string | null>(null);
  const [editOrder, setEditOrder] = useState<RentalOrder | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editPaid, setEditPaid] = useState(0);

  const [clientId, setClientId] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [deposit, setDeposit] = useState(0);
  const [caution, setCaution] = useState(0);
  const [lines, setLines] = useState<{ equipment_id: string; qty: number }[]>([
    { equipment_id: '', qty: 1 },
  ]);

  async function load() {
    if (!estId) {
      setLoading(false);
      return;
    }
    const est = member.establishment_id;
    const [o, c, e] = await Promise.all([
      supabase.from('rental_orders').select('*').eq('establishment_id', est).order('created_at', { ascending: false }),
      supabase.from('rental_clients').select('*').eq('establishment_id', est).order('full_name'),
      supabase.from('rental_equipment').select('*').eq('establishment_id', est).order('name'),
    ]);
    setOrders((o.data ?? []) as RentalOrder[]);
    setClients((c.data ?? []) as RentalClient[]);
    setEquipment((e.data ?? []) as RentalEquipment[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estId]);

  async function createOrder() {
    if (!estId) return;
    const validLines = lines.filter((l) => l.equipment_id && l.qty > 0);
    if (!validLines.length) {
      setError('Ajoutez au moins un article');
      return;
    }
    setSaving(true);
    setError(null);
    setWaLink(null);

    // Disponibilité + conflit de dates
    if (eventDate && returnDate) {
      const { data: overlapOrders } = await supabase
        .from('rental_orders')
        .select('id, client_name, event_date, return_date, status')
        .eq('establishment_id', member.establishment_id)
        .in('status', ['draft', 'confirmed', 'out'])
        .lte('event_date', returnDate)
        .gte('return_date', eventDate);

      if (overlapOrders && overlapOrders.length > 0) {
        const ids = overlapOrders.map((o: { id: string }) => o.id);
        const { data: overlapItems } = await supabase
          .from('rental_order_items')
          .select('equipment_id, qty, equipment_name, order_id')
          .in('order_id', ids);

        for (const l of validLines) {
          const eq = equipment.find((x) => x.id === l.equipment_id);
          if (!eq) continue;
          const reservedOnPeriod = (overlapItems || [])
            .filter((it: { equipment_id: string; qty: number }) => it.equipment_id === l.equipment_id)
            .reduce((s: number, it: { qty: number }) => s + Number(it.qty), 0);
          const free = Number(eq.qty_total) - Number(eq.qty_damaged) - reservedOnPeriod;
          if (l.qty > free) {
            setError(
              `Conflit de dates pour ${eq.name} : ${Math.max(0, free)} dispo sur la période (besoin ${l.qty}).`
            );
            setSaving(false);
            return;
          }
        }
      }
    }

    for (const l of validLines) {
      const eq = equipment.find((x) => x.id === l.equipment_id);
      if (!eq || eq.qty_available < l.qty) {
        setError(`Stock insuffisant pour ${eq?.name || 'article'} (dispo ${eq?.qty_available ?? 0})`);
        setSaving(false);
        return;
      }
    }

    const client = clients.find((c) => c.id === clientId);
    let total = 0;
    const itemRows: Omit<RentalOrderItem, 'id' | 'order_id'>[] = validLines.map((l) => {
      const eq = equipment.find((x) => x.id === l.equipment_id)!;
      const line_total = Number(eq.unit_price) * l.qty;
      total += line_total;
      return {
        equipment_id: eq.id,
        equipment_name: eq.name,
        qty: l.qty,
        unit_price: Number(eq.unit_price),
        line_total,
      };
    });

    const { data: order, error: oErr } = await supabase
      .from('rental_orders')
      .insert({
        establishment_id: member.establishment_id,
        client_id: clientId || null,
        client_name: client?.full_name || null,
        client_phone: client?.phone || null,
        event_date: eventDate || null,
        return_date: returnDate || null,
        status: 'confirmed',
        total_amount: total,
        deposit_amount: Number(deposit) || 0,
        paid_amount: Number(deposit) || 0,
        caution_amount: Number(caution) || 0,
        caution_returned: false,
        created_by: user?.id || null,
      })
      .select()
      .single();

    if (oErr || !order) {
      setError(oErr?.message || 'Erreur création');
      setSaving(false);
      return;
    }

    await supabase.from('rental_order_items').insert(
      itemRows.map((r) => ({ ...r, order_id: order.id }))
    );

    // Reserve stock
    for (const l of validLines) {
      const eq = equipment.find((x) => x.id === l.equipment_id)!;
      await supabase
        .from('rental_equipment')
        .update({
          qty_available: eq.qty_available - l.qty,
          qty_reserved: eq.qty_reserved + l.qty,
        })
        .eq('id', eq.id);
    }

    if (Number(deposit) > 0) {
      await supabase.from('rental_payments').insert({
        establishment_id: member.establishment_id,
        order_id: order.id,
        amount: Number(deposit),
        method: 'cash',
        note: 'Acompte à la commande',
      });
    }

    await notifyTeam(
      member.establishment_id,
      'Nouvelle commande location',
      `${client?.full_name || 'Client'} — ${formatFCFA(total)} — ${eventDate || 'date à préciser'}`,
      '/rent/orders'
    );

    const wa = clientWhatsAppUrl(
      client?.phone,
      `#${order.id.slice(0, 8)}`,
      `Votre commande est confirmée pour le ${eventDate || '…'}.\nTotal: ${formatFCFA(total)}\nAcompte: ${formatFCFA(Number(deposit) || 0)}\nSolde: ${formatFCFA(total - (Number(deposit) || 0))}`
    );
    setWaLink(wa);

    setSaving(false);
    setOpen(false);
    setLines([{ equipment_id: '', qty: 1 }]);
    setDeposit(0);
    setCaution(0);
    setClientId('');
    await load();
  }


  async function saveEditOrder() {
    if (!editOrder) return;
    setSaving(true);
    const { error: err } = await supabase
      .from('rental_orders')
      .update({
        status: editStatus || editOrder.status,
        notes: editNotes || null,
        paid_amount: Number(editPaid) || 0,
      })
      .eq('id', editOrder.id);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setEditOrder(null);
    await load();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary-500" size={28} />
      </div>
    );
  }

  const statusColor = (s: string) =>
    s === 'confirmed' ? 'primary' : s === 'out' ? 'warning' : s === 'returned' ? 'success' : 'neutral';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100">Commandes</h1>
          <p className="text-stone-400 text-sm">Réservations matériel + validation stock</p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Nouvelle commande
        </button>
      </div>

      {waLink && (
        <div className="card mb-4 border border-success-500/30 bg-success-500/5 flex items-center gap-3">
          <MessageCircle className="text-success-400" size={20} />
          <div className="flex-1 text-sm text-stone-300">Commande créée. Notifier le client sur WhatsApp ?</div>
          <a href={waLink} target="_blank" rel="noreferrer" className="btn-primary text-sm flex items-center gap-1">
            WhatsApp <ExternalLink size={14} />
          </a>
        </div>
      )}

      {orders.length === 0 ? (
        <EmptyState icon={<ClipboardList size={48} />} title="Aucune commande" message="Créez une réservation." />
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <button
              type="button"
              key={o.id}
              className="card w-full text-left active:scale-[0.99]"
              onClick={() => {
                setEditOrder(o);
                setEditStatus(o.status);
                setEditNotes(o.notes || '');
                setEditPaid(Number(o.paid_amount) || 0);
                setError(null);
              }}
            >
              <div className="flex flex-wrap items-start gap-2 justify-between">
                <div>
                  <p className="font-medium text-stone-100">{o.client_name || 'Sans client'}</p>
                  <p className="text-xs text-stone-500">
                    Événement {o.event_date || '—'} · Retour {o.return_date || '—'} · Toucher pour modifier
                  </p>
                </div>
                <Badge color={statusColor(o.status) as any}>{RENTAL_STATUS_LABELS[o.status] || o.status}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-sm">
                <span className="text-stone-300">Total {formatFCFA(Number(o.total_amount))}</span>
                <span className="text-stone-400">Payé {formatFCFA(Number(o.paid_amount))}</span>
                <span className="text-amber-400">Solde {formatFCFA(orderBalance(o))}</span>
              </div>
              {o.client_phone && (
                <a
                  href={buildWhatsAppLink(
                    o.client_phone,
                    `Bonjour ${o.client_name || ''}, rappel commande du ${o.event_date || ''} — solde ${formatFCFA(orderBalance(o))}`
                  )}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-sm text-success-400 mt-2"
                >
                  <MessageCircle size={14} /> WhatsApp client
                </a>
              )}
            </button>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nouvelle commande">
        <div className="space-y-3 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="text-sm text-error-300 bg-error-500/10 border border-error-500/30 rounded-xl p-3">{error}</div>
          )}
          <div>
            <label className="label">Client</label>
            <select className="input-field" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">— Choisir —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date événement</label>
              <input type="date" className="input-field" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Date retour</label>
              <input type="date" className="input-field" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Articles</label>
            {lines.map((l, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <select
                  className="input-field flex-1"
                  value={l.equipment_id}
                  onChange={(e) => {
                    const next = [...lines];
                    next[i] = { ...next[i], equipment_id: e.target.value };
                    setLines(next);
                  }}
                >
                  <option value="">Matériel…</option>
                  {equipment.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.name} (dispo {eq.qty_available})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  className="input-field w-20"
                  value={l.qty}
                  onChange={(e) => {
                    const next = [...lines];
                    next[i] = { ...next[i], qty: Number(e.target.value) };
                    setLines(next);
                  }}
                />
              </div>
            ))}
            <button
              type="button"
              className="text-sm text-primary-400"
              onClick={() => setLines([...lines, { equipment_id: '', qty: 1 }])}
            >
              + Ligne
            </button>
          </div>
          <div>
            <label className="label">Acompte (FCFA)</label>
            <input type="number" min={0} className="input-field" value={deposit} onChange={(e) => setDeposit(Number(e.target.value))} />
            <label className="label mt-2">Caution (FCFA)</label>
            <input type="number" min={0} className="input-field" value={caution} onChange={(e) => setCaution(Number(e.target.value))} />
          </div>
          <button onClick={createOrder} disabled={saving} className="btn-primary w-full">
            {saving ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Confirmer la commande'}
          </button>
        </div>
      </Modal>

      <Modal open={!!editOrder} onClose={() => setEditOrder(null)} title="Modifier la commande">
        {editOrder && (
          <div className="space-y-3">
            {error && (
              <div className="text-sm text-error-300 bg-error-500/10 border border-error-500/30 rounded-xl p-3">{error}</div>
            )}
            <p className="text-sm text-stone-400">
              {editOrder.client_name} · Événement {editOrder.event_date || '—'}
            </p>
            <div>
              <label className="label">Statut</label>
              <select className="input-field" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                {Object.entries(RENTAL_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Montant payé (FCFA)</label>
              <input type="number" min={0} className="input-field" value={editPaid} onChange={(e) => setEditPaid(Number(e.target.value))} />
            </div>
            <div>
              <label className="label">Notes</label>
              <input className="input-field" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
            </div>
            <button type="button" onClick={saveEditOrder} disabled={saving} className="btn-primary w-full">
              {saving ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Enregistrer'}
            </button>
          </div>
        )}
      </Modal>

    </div>
  );
}
