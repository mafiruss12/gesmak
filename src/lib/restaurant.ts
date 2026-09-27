import { supabase } from './supabase';

export type TableStatus = 'free' | 'occupied' | 'reserved' | 'cleaning' | 'libre' | 'occupee';

export interface MenuCategory {
  id: string;
  establishment_id: string;
  name: string;
  sort_order: number;
}

export interface MenuItem {
  id: string;
  establishment_id: string;
  category_id: string | null;
  name: string;
  description?: string | null;
  price: number;
  is_available: boolean;
  linked_product_id?: string | null;
  sort_order: number;
  image_url?: string | null;
}

export interface MenuItemOption {
  id: string;
  menu_item_id: string;
  name: string;
  price_delta: number;
  is_required: boolean;
  max_choices: number;
}

export interface RestaurantReservation {
  id: string;
  establishment_id: string;
  table_id: string | null;
  customer_name: string;
  phone: string | null;
  party_size: number;
  reservation_time: string;
  status: 'confirmed' | 'seated' | 'cancelled' | 'no_show';
  notes?: string | null;
}

export async function listCategories(estId: string) {
  const { data, error } = await supabase
    .from('menu_categories')
    .select('*')
    .eq('establishment_id', estId)
    .order('sort_order');
  if (error) throw error;
  return (data || []) as MenuCategory[];
}

export async function upsertCategory(
  estId: string,
  name: string,
  sort_order = 0,
  id?: string,
) {
  if (id) {
    const { error } = await supabase.from('menu_categories').update({ name, sort_order }).eq('id', id);
    if (error) throw error;
    return id;
  }
  const { data, error } = await supabase
    .from('menu_categories')
    .insert({ establishment_id: estId, name, sort_order })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteCategory(id: string) {
  const { error } = await supabase.from('menu_categories').delete().eq('id', id);
  if (error) throw error;
}

export async function listMenuItems(estId: string) {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('establishment_id', estId)
    .order('sort_order');
  if (error) throw error;
  return (data || []) as MenuItem[];
}

export async function upsertMenuItem(
  estId: string,
  payload: Partial<MenuItem> & { name: string; price: number },
  id?: string,
) {
  const row = {
    establishment_id: estId,
    name: payload.name,
    price: payload.price,
    description: payload.description ?? null,
    category_id: payload.category_id ?? null,
    is_available: payload.is_available ?? true,
    linked_product_id: payload.linked_product_id ?? null,
    sort_order: payload.sort_order ?? 0,
    image_url: payload.image_url ?? null,
  };
  if (id) {
    const { error } = await supabase.from('menu_items').update(row).eq('id', id);
    if (error) throw error;
    return id;
  }
  const { data, error } = await supabase.from('menu_items').insert(row).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteMenuItem(id: string) {
  const { error } = await supabase.from('menu_items').delete().eq('id', id);
  if (error) throw error;
}

export async function listOptions(menuItemId: string) {
  const { data, error } = await supabase
    .from('menu_item_options')
    .select('*')
    .eq('menu_item_id', menuItemId)
    .order('name');
  if (error) throw error;
  return (data || []) as MenuItemOption[];
}

export async function upsertOption(
  menuItemId: string,
  payload: { name: string; price_delta?: number; is_required?: boolean; max_choices?: number },
  id?: string,
) {
  const row = {
    menu_item_id: menuItemId,
    name: payload.name,
    price_delta: payload.price_delta ?? 0,
    is_required: payload.is_required ?? false,
    max_choices: payload.max_choices ?? 1,
  };
  if (id) {
    const { error } = await supabase.from('menu_item_options').update(row).eq('id', id);
    if (error) throw error;
    return id;
  }
  const { data, error } = await supabase.from('menu_item_options').insert(row).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteOption(id: string) {
  const { error } = await supabase.from('menu_item_options').delete().eq('id', id);
  if (error) throw error;
}

export async function listReservations(estId: string, fromIso?: string) {
  let q = supabase
    .from('restaurant_reservations')
    .select('*')
    .eq('establishment_id', estId)
    .order('reservation_time', { ascending: true });
  if (fromIso) q = q.gte('reservation_time', fromIso);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as RestaurantReservation[];
}

export async function upsertReservation(
  estId: string,
  payload: Omit<RestaurantReservation, 'id' | 'establishment_id'> & { id?: string },
  userId?: string,
) {
  const row = {
    establishment_id: estId,
    table_id: payload.table_id,
    customer_name: payload.customer_name,
    phone: payload.phone,
    party_size: payload.party_size,
    reservation_time: payload.reservation_time,
    status: payload.status,
    notes: payload.notes ?? null,
    created_by: userId ?? null,
  };
  if (payload.id) {
    const { error } = await supabase.from('restaurant_reservations').update(row).eq('id', payload.id);
    if (error) throw error;
    return payload.id;
  }
  const { data, error } = await supabase.from('restaurant_reservations').insert(row).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function setTableStatus(tableId: string, status: string) {
  const { error } = await supabase.from('restaurant_tables').update({ status }).eq('id', tableId);
  if (error) throw error;
}

/** Ouvre une commande liée à une table (réutilise orders existant) */
export async function openOrderForTable(params: {
  estId: string;
  tableId: string;
  tableNumber: string;
  userId: string;
  covers?: number;
}) {
  await setTableStatus(params.tableId, 'occupied');
  const { data, error } = await supabase
    .from('orders')
    .insert({
      establishment_id: params.estId,
      table_id: params.tableId,
      table_number: params.tableNumber,
      status: 'pending',
      order_type: 'dine_in',
      total: 0,
      created_by: params.userId,
      source: 'restaurant',
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function addMenuItemToOrder(params: {
  orderId: string;
  menuItem: MenuItem;
  qty: number;
  options?: { name: string; price_delta: number }[];
  notes?: string;
}) {
  const optSum = (params.options || []).reduce((s, o) => s + Number(o.price_delta || 0), 0);
  const unit = Number(params.menuItem.price) + optSum;
  const { error } = await supabase.from('order_items').insert({
    order_id: params.orderId,
    product_id: params.menuItem.linked_product_id || null,
    product_name: params.menuItem.name,
    qty: params.qty,
    unit_price: unit,
    status: 'pending',
    menu_item_id: params.menuItem.id,
    selected_options: params.options || [],
    notes: params.notes || null,
  });
  if (error) throw error;
  // recalc total
  const { data: items } = await supabase
    .from('order_items')
    .select('qty, unit_price')
    .eq('order_id', params.orderId);
  const total = (items || []).reduce((s, i) => s + Number(i.qty) * Number(i.unit_price), 0);
  await supabase.from('orders').update({ total }).eq('id', params.orderId);
}
