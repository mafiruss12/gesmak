import { supabase } from './supabase';

export type RestaurantDayStats = {
  ordersCount: number;
  revenue: number;
  avgTicket: number;
  topDishes: { name: string; qty: number; revenue: number }[];
  tablesTotal: number;
  tablesOccupied: number;
  occupancyRate: number;
};

/** Stats du jour (timezone locale navigateur) pour un établissement restaurant */
export async function loadRestaurantDayStats(estId: string): Promise<RestaurantDayStats> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const from = start.toISOString();
  const to = end.toISOString();

  const [ordRes, tabRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id, total, status, paid_at, created_at')
      .eq('establishment_id', estId)
      .gte('created_at', from)
      .lte('created_at', to),
    supabase.from('restaurant_tables').select('id, status').eq('establishment_id', estId),
  ]);

  const orders = ordRes.data || [];
  const paidOrServed = orders.filter((o) =>
    ['served', 'paid', 'ready', 'preparing', 'pending'].includes(String(o.status)),
  );
  const revenueOrders = orders.filter((o) =>
    ['served', 'paid'].includes(String(o.status)) || o.paid_at,
  );
  const revenue = revenueOrders.reduce((s, o) => s + Number(o.total || 0), 0);
  const ordersCount = revenueOrders.length || paidOrServed.filter((o) => o.paid_at).length;
  const avgTicket = ordersCount > 0 ? revenue / ordersCount : 0;

  const orderIds = orders.map((o) => o.id);
  let topDishes: RestaurantDayStats['topDishes'] = [];
  if (orderIds.length) {
    const { data: items } = await supabase
      .from('order_items')
      .select('product_name, qty, unit_price, order_id')
      .in('order_id', orderIds);
    const map = new Map<string, { qty: number; revenue: number }>();
    for (const it of items || []) {
      const name = String(it.product_name || '—');
      const cur = map.get(name) || { qty: 0, revenue: 0 };
      cur.qty += Number(it.qty || 0);
      cur.revenue += Number(it.qty || 0) * Number(it.unit_price || 0);
      map.set(name, cur);
    }
    topDishes = Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }

  const tables = tabRes.data || [];
  const tablesTotal = tables.length;
  const tablesOccupied = tables.filter((t) =>
    ['occupied', 'occupee', 'reserved'].includes(String(t.status)),
  ).length;
  const occupancyRate = tablesTotal > 0 ? tablesOccupied / tablesTotal : 0;

  return {
    ordersCount: revenueOrders.length,
    revenue,
    avgTicket,
    topDishes,
    tablesTotal,
    tablesOccupied,
    occupancyRate,
  };
}
