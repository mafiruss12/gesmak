import { supabase } from '@/lib/supabase';
import { isOnline, queueAdd } from '@/lib/offline';
import { addTicket } from '@/lib/liveDaySales';
import type { LivePayMethod } from '@/lib/liveDaySales';

export type ClosePay = 'cash' | 'mobile' | 'mixed';

type OrderLine = {
  product_id: string | null;
  product_name: string;
  qty: number;
  unit_price: number;
};

/** Agrège les lignes de plusieurs commandes */
export function aggregateOrderLines(lines: OrderLine[]) {
  const map = new Map<string, OrderLine & { key: string }>();
  for (const l of lines) {
    const key = l.product_id || `name:${l.product_name}`;
    const cur = map.get(key);
    if (cur) cur.qty += l.qty;
    else map.set(key, { ...l, key });
  }
  return Array.from(map.values());
}

/**
 * Clôture table / commandes :
 * - paiement
 * - statut served
 * - décrément stock une fois
 * - table libre
 * - option : pousser vers ventes journée
 */
export async function closeTableOrders(opts: {
  establishmentId: string;
  orderIds: string[];
  tableId?: string | null;
  payment: ClosePay;
  paidAmount: number;
  pushToLiveSales?: boolean;
  productsCost?: Record<string, number>;
}): Promise<{ ok: boolean; error?: string }> {
  const { establishmentId, orderIds, tableId, payment, paidAmount, pushToLiveSales } = opts;
  if (!orderIds.length) return { ok: false, error: 'Aucune commande' };

  const { data: items, error: iErr } = await supabase
    .from('order_items')
    .select('order_id, product_id, product_name, qty, unit_price')
    .in('order_id', orderIds);
  if (iErr) return { ok: false, error: iErr.message };

  const lines = (items || []) as OrderLine[];
  const agg = aggregateOrderLines(lines);

  // Décrément stock (une fois par produit)
  for (const line of agg) {
    if (!line.product_id) continue;
    const { data: prod } = await supabase
      .from('products')
      .select('id, stock')
      .eq('id', line.product_id)
      .maybeSingle();
    if (!prod) continue;
    const prev = Math.floor(Number(prod.stock) || 0);
    const next = Math.max(0, prev - line.qty);
    if (!isOnline()) {
      await queueAdd('products', 'update', { stock: next, _prev_stock: prev }, { id: line.product_id });
    } else {
      await supabase.from('products').update({ stock: next }).eq('id', line.product_id);
    }
  }

  const paidAt = new Date().toISOString();
  for (const oid of orderIds) {
    await supabase
      .from('orders')
      .update({
        status: 'served',
        payment_method: payment,
        paid_at: paidAt,
        paid_amount: paidAmount,
        stock_deducted: true,
      })
      .eq('id', oid);
    await supabase.from('order_items').update({ status: 'served' }).eq('order_id', oid);
  }

  if (tableId) {
    await supabase.from('restaurant_tables').update({ status: 'free' }).eq('id', tableId);
  }

  if (pushToLiveSales && agg.length) {
    const date = paidAt.slice(0, 10);
    const liveLines = agg
      .filter((l) => l.product_id)
      .map((l) => ({
        product_id: l.product_id as string,
        name: l.product_name,
        price: Math.round(Number(l.unit_price) || 0),
        cost: opts.productsCost?.[l.product_id as string] || 0,
        qty: l.qty,
      }));
    if (liveLines.length) {
      addTicket(establishmentId, date, liveLines, payment as LivePayMethod, 'Clôture table QR');
    }
  }

  return { ok: true };
}


export type OrderLineFull = OrderLine & {
  id: string;
  order_id: string;
  status?: string | null;
};

/**
 * Scission d'addition : encaisser seulement certaines lignes.
 * - décrémente le stock des lignes payées (si product_id)
 * - si toutes les lignes de la commande sont payées → commande served + table free
 * - sinon laisse la commande ouverte avec total recalculé sur les lignes restantes
 */
export async function closeOrderLinesPartial(opts: {
  establishmentId: string;
  orderId: string;
  tableId?: string | null;
  itemIds: string[];
  payment: ClosePay;
  pushToLiveSales?: boolean;
}): Promise<{ ok: boolean; error?: string; remainingTotal?: number }> {
  const { establishmentId, orderId, tableId, itemIds, payment, pushToLiveSales } = opts;
  if (!itemIds.length) return { ok: false, error: 'Aucune ligne sélectionnée' };

  const { data: allItems, error } = await supabase
    .from('order_items')
    .select('id, order_id, product_id, product_name, qty, unit_price, status')
    .eq('order_id', orderId);
  if (error) return { ok: false, error: error.message };

  const items = (allItems || []) as OrderLineFull[];
  const selected = items.filter((i) => itemIds.includes(i.id));
  if (!selected.length) return { ok: false, error: 'Lignes introuvables' };

  const paidAmount = selected.reduce((s, i) => s + Number(i.qty) * Number(i.unit_price), 0);

  // stock
  const agg = aggregateOrderLines(selected);
  for (const line of agg) {
    if (!line.product_id) continue;
    const { data: prod } = await supabase
      .from('products')
      .select('id, stock')
      .eq('id', line.product_id)
      .maybeSingle();
    if (!prod) continue;
    const prev = Math.floor(Number(prod.stock) || 0);
    const next = Math.max(0, prev - line.qty);
    if (!isOnline()) {
      await queueAdd('products', 'update', { stock: next, _prev_stock: prev }, { id: line.product_id });
    } else {
      await supabase.from('products').update({ stock: next }).eq('id', line.product_id);
    }
  }

  // mark selected lines paid/served
  await supabase
    .from('order_items')
    .update({ status: 'served' })
    .in('id', selected.map((i) => i.id));

  const remaining = items.filter((i) => !itemIds.includes(i.id) && i.status !== 'served');
  const remainingTotal = remaining.reduce((s, i) => s + Number(i.qty) * Number(i.unit_price), 0);
  const paidAt = new Date().toISOString();

  if (remaining.length === 0) {
    await supabase
      .from('orders')
      .update({
        status: 'served',
        payment_method: payment,
        paid_at: paidAt,
        paid_amount: paidAmount,
        stock_deducted: true,
        total: paidAmount,
      })
      .eq('id', orderId);
    if (tableId) {
      await supabase.from('restaurant_tables').update({ status: 'free' }).eq('id', tableId);
    }
  } else {
    await supabase
      .from('orders')
      .update({
        total: remainingTotal,
        notes: `Partiel ${payment} ${paidAmount} FCFA à ${paidAt}`,
      })
      .eq('id', orderId);
  }

  if (pushToLiveSales) {
    const date = paidAt.slice(0, 10);
    const liveLines = agg
      .filter((l) => l.product_id)
      .map((l) => ({
        product_id: l.product_id as string,
        name: l.product_name,
        price: Math.round(Number(l.unit_price) || 0),
        cost: 0,
        qty: l.qty,
      }));
    if (liveLines.length) {
      addTicket(establishmentId, date, liveLines, payment as LivePayMethod, 'Scission addition');
    }
  }

  return { ok: true, remainingTotal };
}
