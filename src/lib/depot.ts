import { supabase } from '@/lib/supabase';

export type DepotClient = {
  id: string;
  depot_id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  zone?: string | null;
  payment_terms?: string | null;
  linked_establishment_id?: string | null;
  balance?: number | null;
  notes?: string | null;
  status?: string | null;
  created_at?: string;
  lat?: number | null;
  lng?: number | null;
  credit_limit?: number | null;
  payment_days?: number | null;
  price_tier?: string | null;
};

export type DepotDelivery = {
  id: string;
  depot_id: string;
  client_id: string;
  status: string;
  delivery_date?: string | null;
  total_amount?: number | null;
  paid_amount?: number | null;
  payment_method?: string | null;
  driver_name?: string | null;
  note?: string | null;
  delivered_at?: string | null;
  created_at?: string;
  depot_clients?: { name?: string; phone?: string | null } | null;
};

export type DepotDeliveryItem = {
  id?: string;
  delivery_id?: string;
  product_id?: string | null;
  product_name: string;
  qty: number;
  unit_price: number;
  line_total: number;
};

export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  prepared: 'Préparée',
  in_transit: 'En route',
  delivered: 'Livrée',
  cancelled: 'Annulée',
};

export async function listDepotClients(depotId: string): Promise<DepotClient[]> {
  const { data, error } = await supabase
    .from('depot_clients')
    .select('*')
    .eq('depot_id', depotId)
    .order('name');
  if (error) {
    console.error('listDepotClients', error);
    return [];
  }
  return (data || []) as DepotClient[];
}

export async function upsertDepotClient(
  payload: Partial<DepotClient> & { depot_id: string; name: string }
): Promise<{ ok: boolean; error?: string; id?: string }> {
  if (payload.id) {
    const { error } = await supabase.from('depot_clients').update(payload).eq('id', payload.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: payload.id };
  }
  const { data, error } = await supabase.from('depot_clients').insert(payload).select('id').single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}

export async function listDepotDeliveries(depotId: string): Promise<DepotDelivery[]> {
  const { data, error } = await supabase
    .from('depot_deliveries')
    .select('*, depot_clients(name, phone)')
    .eq('depot_id', depotId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    console.error('listDepotDeliveries', error);
    return [];
  }
  return (data || []) as DepotDelivery[];
}

export async function listDeliveryItems(deliveryId: string): Promise<DepotDeliveryItem[]> {
  const { data, error } = await supabase
    .from('depot_delivery_items')
    .select('*')
    .eq('delivery_id', deliveryId);
  if (error) return [];
  return (data || []) as DepotDeliveryItem[];
}

export async function createDepotDelivery(input: {
  depot_id: string;
  client_id: string;
  items: DepotDeliveryItem[];
  payment_method?: string;
  paid_amount?: number;
  driver_name?: string;
  note?: string;
  status?: string;
  created_by?: string | null;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  const total = input.items.reduce((s, i) => s + (Number(i.line_total) || Number(i.qty) * Number(i.unit_price) || 0), 0);
  const { data: del, error } = await supabase
    .from('depot_deliveries')
    .insert({
      depot_id: input.depot_id,
      client_id: input.client_id,
      status: input.status || 'prepared',
      total_amount: total,
      paid_amount: input.paid_amount ?? 0,
      payment_method: input.payment_method || 'cash',
      driver_name: input.driver_name || null,
      note: input.note || null,
      created_by: input.created_by || null,
      delivery_date: new Date().toISOString().slice(0, 10),
    })
    .select('id')
    .single();
  if (error || !del?.id) return { ok: false, error: error?.message || 'Création impossible' };

  const rows = input.items.map((i) => ({
    delivery_id: del.id,
    product_id: i.product_id || null,
    product_name: i.product_name,
    qty: Number(i.qty) || 0,
    unit_price: Number(i.unit_price) || 0,
    line_total: Number(i.line_total) || Number(i.qty) * Number(i.unit_price) || 0,
  }));
  const { error: ie } = await supabase.from('depot_delivery_items').insert(rows);
  if (ie) return { ok: false, error: ie.message };
  return { ok: true, id: del.id };
}

export async function setDeliveryStatus(id: string, status: string): Promise<{ ok: boolean; error?: string }> {
  if (status === 'delivered') {
    const { data, error } = await supabase.rpc('confirm_depot_delivery', { p_delivery_id: id });
    if (error) return { ok: false, error: error.message };
    if (data && (data as { ok?: boolean }).ok === false) {
      return { ok: false, error: 'Confirmation refusée' };
    }
    return { ok: true };
  }
  const { error } = await supabase.from('depot_deliveries').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function listMaquisEstablishments(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from('establishments')
    .select('id, name, type')
    .in('type', ['maquis', 'restaurant', 'bar'])
    .order('name')
    .limit(200);
  if (error) return [];
  return (data || []).map((e: { id: string; name: string }) => ({ id: e.id, name: e.name }));
}

export type DepotTour = {
  id: string;
  depot_id: string;
  tour_date: string;
  zone?: string | null;
  driver_user_id?: string | null;
  driver_name?: string | null;
  vehicle_label?: string | null;
  status: string;
  notes?: string | null;
};

export async function listDepotTours(depotId: string, fromDate?: string) {
  let q = supabase
    .from('depot_tours')
    .select('*')
    .eq('depot_id', depotId)
    .order('tour_date', { ascending: false })
    .limit(50);
  if (fromDate) q = q.gte('tour_date', fromDate);
  const { data, error } = await q;
  if (error) {
    console.error('listDepotTours', error);
    return [] as DepotTour[];
  }
  return (data || []) as DepotTour[];
}

export async function upsertDepotTour(
  payload: Partial<DepotTour> & { depot_id: string; tour_date: string },
): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (payload.id) {
    const { error } = await supabase.from('depot_tours').update(payload).eq('id', payload.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: payload.id };
  }
  const { data, error } = await supabase.from('depot_tours').insert(payload).select('id').single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}

export async function assignDeliveriesToTour(tourId: string, deliveryIds: string[]) {
  for (let i = 0; i < deliveryIds.length; i++) {
    await supabase
      .from('depot_deliveries')
      .update({ tour_id: tourId, sequence_order: i + 1, status: 'prepared' })
      .eq('id', deliveryIds[i]);
  }
}

export async function pushTrackingPoint(input: {
  tour_id: string;
  depot_id: string;
  driver_user_id: string;
  lat: number;
  lng: number;
  status?: string;
}) {
  const { error } = await supabase.from('delivery_tracking').insert({
    tour_id: input.tour_id,
    depot_id: input.depot_id,
    driver_user_id: input.driver_user_id,
    lat: input.lat,
    lng: input.lng,
    status: input.status || 'moving',
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function latestTrackingByTour(depotId: string) {
  const { data, error } = await supabase
    .from('delivery_tracking')
    .select('*')
    .eq('depot_id', depotId)
    .order('recorded_at', { ascending: false })
    .limit(200);
  if (error) return [];
  // keep latest per tour
  const map = new Map<string, (typeof data)[0]>();
  for (const row of data || []) {
    if (!map.has(row.tour_id)) map.set(row.tour_id, row);
  }
  return Array.from(map.values());
}

export async function listReceivables(depotId: string) {
  const { data, error } = await supabase
    .from('depot_deliveries')
    .select('*, depot_clients(name, phone, credit_limit, payment_days, balance)')
    .eq('depot_id', depotId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return [];
  return (data || []).filter((d) => Number(d.total_amount || 0) > Number(d.paid_amount || 0));
}

export async function recordDeliveryReturn(input: {
  delivery_id: string;
  items: { id: string; qty_returned?: number; qty_broken?: number }[];
  returned_amount?: number;
  breakage_amount?: number;
}) {
  for (const it of input.items) {
    await supabase
      .from('depot_delivery_items')
      .update({
        qty_returned: it.qty_returned ?? 0,
        qty_broken: it.qty_broken ?? 0,
      })
      .eq('id', it.id);
  }
  await supabase
    .from('depot_deliveries')
    .update({
      returned_amount: input.returned_amount ?? 0,
      breakage_amount: input.breakage_amount ?? 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.delivery_id);
  return { ok: true as const };
}

export async function listPublicDepots() {
  const { data, error } = await supabase
    .from('establishments')
    .select('id, name, public_zone, public_lat, public_lng, public_phone, type')
    .eq('public_visible', true)
    .in('type', ['depot', 'grossiste']);
  if (error) {
    // fallback without filter if column missing on client cache
    console.error(error);
    return [];
  }
  return data || [];
}
