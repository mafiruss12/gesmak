/**
 * Module Complexe Hôtelier — accès données (extension non destructive)
 */
import { supabase } from '@/lib/supabase';

export const HOTEL_SERVICE_PRESETS = [
  { code: 'hebergement', name: 'Hébergement', description: 'Chambres et réservations' },
  { code: 'restaurant', name: 'Restaurant', description: 'Plats, commandes, tables, caisse' },
  { code: 'bar', name: 'Bar', description: 'Boissons, ventes, caisse' },
  { code: 'cuisine', name: 'Cuisine', description: 'Ingrédients et production' },
  { code: 'piscine', name: 'Piscine', description: 'Accès et consommables' },
  { code: 'spa', name: 'Spa', description: 'Prestations et produits' },
  { code: 'evenementiel', name: 'Salle événementielle', description: 'Salles et équipements' },
  { code: 'boutique', name: 'Boutique', description: 'Articles vendus' },
  { code: 'housekeeping', name: 'Housekeeping', description: 'Entretien et tâches' },
  { code: 'maintenance', name: 'Maintenance', description: 'Interventions techniques' },
] as const;

export type RoomStatus =
  | 'available'
  | 'occupied'
  | 'reserved'
  | 'cleaning'
  | 'maintenance'
  | 'out_of_service';

export type ReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export const ROOM_STATUS_LABELS: Record<RoomStatus, string> = {
  available: 'Disponible',
  occupied: 'Occupée',
  reserved: 'Réservée',
  cleaning: 'Nettoyage',
  maintenance: 'Maintenance',
  out_of_service: 'Hors service',
};

export const ROOM_STATUS_COLORS: Record<RoomStatus, string> = {
  available: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  occupied: 'bg-red-100 text-red-800 border-red-300',
  reserved: 'bg-amber-100 text-amber-800 border-amber-300',
  cleaning: 'bg-sky-100 text-sky-800 border-sky-300',
  maintenance: 'bg-orange-100 text-orange-800 border-orange-300',
  out_of_service: 'bg-stone-200 text-stone-700 border-stone-400',
};

export const RES_STATUS_LABELS: Record<ReservationStatus, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  arrived: 'Arrivée',
  in_progress: 'En cours',
  completed: 'Terminée',
  cancelled: 'Annulée',
  no_show: 'No-show',
};

export function isHotelComplex(type: string | null | undefined): boolean {
  const v = (type || '').toLowerCase();
  return (
    v === 'complexe_hotelier' ||
    v === 'complexe' ||
    v === 'hotel' ||
    v === 'hôtel' ||
    v === 'hotelier'
  );
}

export async function ensureDefaultHotelServices(establishmentId: string, codes?: string[]) {
  const wanted = codes?.length
    ? HOTEL_SERVICE_PRESETS.filter((p) => codes.includes(p.code))
    : [...HOTEL_SERVICE_PRESETS];
  const rows = wanted.map((p, i) => ({
    establishment_id: establishmentId,
    code: p.code,
    name: p.name,
    description: p.description,
    is_active: true,
    sort_order: i,
  }));
  const { error } = await supabase.from('hotel_services').upsert(rows, {
    onConflict: 'establishment_id,code',
  });
  return { error: error?.message };
}

export async function listHotelServices(establishmentId: string) {
  const { data, error } = await supabase
    .from('hotel_services')
    .select('*')
    .eq('establishment_id', establishmentId)
    .order('sort_order');
  return { data: data || [], error: error?.message };
}

export async function listRooms(establishmentId: string) {
  const { data, error } = await supabase
    .from('hotel_rooms')
    .select('*, hotel_room_types(name, price_per_night, capacity)')
    .eq('establishment_id', establishmentId)
    .order('number');
  return { data: data || [], error: error?.message };
}

export async function listRoomTypes(establishmentId: string) {
  const { data, error } = await supabase
    .from('hotel_room_types')
    .select('*')
    .eq('establishment_id', establishmentId)
    .order('name');
  return { data: data || [], error: error?.message };
}

export async function createRoomType(
  establishmentId: string,
  input: {
    name: string;
    description?: string;
    capacity?: number;
    beds?: number;
    price_per_night?: number;
  },
) {
  const { data, error } = await supabase
    .from('hotel_room_types')
    .insert({
      establishment_id: establishmentId,
      name: input.name,
      description: input.description || null,
      capacity: input.capacity ?? 2,
      beds: input.beds ?? 1,
      price_per_night: input.price_per_night ?? 0,
    })
    .select()
    .single();
  return { data, error: error?.message };
}

export async function createRoom(
  establishmentId: string,
  input: {
    number: string;
    floor?: string;
    room_type_id?: string | null;
    price_per_night?: number;
    capacity?: number;
    status?: RoomStatus;
  },
) {
  const { data, error } = await supabase
    .from('hotel_rooms')
    .insert({
      establishment_id: establishmentId,
      number: input.number,
      floor: input.floor || null,
      room_type_id: input.room_type_id || null,
      price_per_night: input.price_per_night ?? 0,
      capacity: input.capacity ?? 2,
      status: input.status || 'available',
    })
    .select()
    .single();
  return { data, error: error?.message };
}

export async function updateRoomStatus(roomId: string, status: RoomStatus) {
  const { error } = await supabase.from('hotel_rooms').update({ status }).eq('id', roomId);
  return { error: error?.message };
}

export async function listGuests(establishmentId: string, q?: string) {
  let query = supabase
    .from('hotel_guests')
    .select('*')
    .eq('establishment_id', establishmentId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (q?.trim()) {
    query = query.or(
      `last_name.ilike.%${q.trim()}%,first_name.ilike.%${q.trim()}%,phone.ilike.%${q.trim()}%`,
    );
  }
  const { data, error } = await query;
  return { data: data || [], error: error?.message };
}

export async function upsertGuest(
  establishmentId: string,
  input: {
    id?: string;
    first_name: string;
    last_name: string;
    phone?: string;
    email?: string;
    address?: string;
    id_document?: string;
    notes?: string;
  },
) {
  if (input.id) {
    const { data, error } = await supabase
      .from('hotel_guests')
      .update({
        first_name: input.first_name,
        last_name: input.last_name,
        phone: input.phone || null,
        email: input.email || null,
        address: input.address || null,
        id_document: input.id_document || null,
        notes: input.notes || null,
      })
      .eq('id', input.id)
      .select()
      .single();
    return { data, error: error?.message };
  }
  const { data, error } = await supabase
    .from('hotel_guests')
    .insert({
      establishment_id: establishmentId,
      first_name: input.first_name,
      last_name: input.last_name,
      phone: input.phone || null,
      email: input.email || null,
      address: input.address || null,
      id_document: input.id_document || null,
      notes: input.notes || null,
    })
    .select()
    .single();
  return { data, error: error?.message };
}

export async function listReservations(establishmentId: string) {
  const { data, error } = await supabase
    .from('hotel_reservations')
    .select('*, hotel_guests(first_name, last_name, phone), hotel_rooms(number, status)')
    .eq('establishment_id', establishmentId)
    .order('check_in', { ascending: false })
    .limit(200);
  return { data: data || [], error: error?.message };
}

export async function createReservation(
  establishmentId: string,
  input: {
    guest_id: string;
    room_id?: string | null;
    check_in: string;
    check_out: string;
    adults?: number;
    children?: number;
    rate?: number;
    discount?: number;
    taxes?: number;
    total?: number;
    amount_paid?: number;
    payment_method?: string;
    status?: ReservationStatus;
    notes?: string;
    created_by?: string;
  },
) {
  const nights = Math.max(
    1,
    Math.round(
      (new Date(input.check_out).getTime() - new Date(input.check_in).getTime()) / 86400000,
    ),
  );
  const rate = input.rate ?? 0;
  const discount = input.discount ?? 0;
  const taxes = input.taxes ?? 0;
  const total = input.total ?? rate * nights - discount + taxes;

  const { data, error } = await supabase
    .from('hotel_reservations')
    .insert({
      establishment_id: establishmentId,
      guest_id: input.guest_id,
      room_id: input.room_id || null,
      check_in: input.check_in,
      check_out: input.check_out,
      adults: input.adults ?? 1,
      children: input.children ?? 0,
      rate,
      discount,
      taxes,
      total,
      amount_paid: input.amount_paid ?? 0,
      payment_method: input.payment_method || null,
      status: input.status || 'confirmed',
      notes: input.notes || null,
      created_by: input.created_by || null,
    })
    .select()
    .single();

  if (!error && input.room_id && (input.status === 'confirmed' || !input.status)) {
    await updateRoomStatus(input.room_id, 'reserved');
  }
  return { data, error: error?.message };
}

export async function checkInReservation(reservationId: string, roomId?: string | null) {
  const { data: res, error: e1 } = await supabase
    .from('hotel_reservations')
    .select('*')
    .eq('id', reservationId)
    .single();
  if (e1 || !res) return { error: e1?.message || 'Réservation introuvable' };

  const rid = roomId || res.room_id;
  if (!rid) return { error: 'Attribuez une chambre avant le check-in' };

  const { error: e2 } = await supabase
    .from('hotel_reservations')
    .update({
      status: 'in_progress',
      room_id: rid,
      checked_in_at: new Date().toISOString(),
    })
    .eq('id', reservationId);
  if (e2) return { error: e2.message };

  await updateRoomStatus(rid, 'occupied');
  return { error: undefined };
}

export async function checkOutReservation(reservationId: string, toCleaning = true) {
  const { data: res, error: e1 } = await supabase
    .from('hotel_reservations')
    .select('*')
    .eq('id', reservationId)
    .single();
  if (e1 || !res) return { error: e1?.message || 'Réservation introuvable' };

  const { error: e2 } = await supabase
    .from('hotel_reservations')
    .update({
      status: 'completed',
      checked_out_at: new Date().toISOString(),
    })
    .eq('id', reservationId);
  if (e2) return { error: e2.message };

  if (res.room_id) {
    await updateRoomStatus(res.room_id, toCleaning ? 'cleaning' : 'available');
    if (toCleaning) {
      await supabase.from('hotel_housekeeping').insert({
        establishment_id: res.establishment_id,
        room_id: res.room_id,
        status: 'pending',
        notes: 'Check-out automatique',
      });
    }
  }
  return { error: undefined };
}

export async function listConsumptions(reservationId: string) {
  const { data, error } = await supabase
    .from('hotel_consumptions')
    .select('*')
    .eq('reservation_id', reservationId)
    .order('created_at');
  return { data: data || [], error: error?.message };
}

export async function addConsumption(
  establishmentId: string,
  input: {
    reservation_id: string;
    room_id?: string | null;
    service_code?: string;
    description: string;
    quantity?: number;
    unit_price: number;
    created_by?: string;
  },
) {
  const qty = input.quantity ?? 1;
  const total = qty * input.unit_price;
  const { data, error } = await supabase
    .from('hotel_consumptions')
    .insert({
      establishment_id: establishmentId,
      reservation_id: input.reservation_id,
      room_id: input.room_id || null,
      service_code: input.service_code || null,
      description: input.description,
      quantity: qty,
      unit_price: input.unit_price,
      total,
      created_by: input.created_by || null,
    })
    .select()
    .single();
  return { data, error: error?.message };
}

export async function getDashboardStats(establishmentId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: rooms }, { data: reservations }, { data: hk }, { data: maint }] =
    await Promise.all([
      supabase.from('hotel_rooms').select('id, status').eq('establishment_id', establishmentId),
      supabase
        .from('hotel_reservations')
        .select('id, status, check_in, check_out, total, amount_paid')
        .eq('establishment_id', establishmentId),
      supabase
        .from('hotel_housekeeping')
        .select('id, status')
        .eq('establishment_id', establishmentId)
        .neq('status', 'done'),
      supabase
        .from('hotel_maintenance')
        .select('id, status')
        .eq('establishment_id', establishmentId)
        .in('status', ['open', 'in_progress']),
    ]);

  const roomList = rooms || [];
  const resList = reservations || [];
  const byStatus = (s: string) => roomList.filter((r) => r.status === s).length;
  const arrivals = resList.filter((r) => r.check_in === today && r.status !== 'cancelled').length;
  const departures = resList.filter((r) => r.check_out === today && r.status === 'in_progress')
    .length;
  const occupied = byStatus('occupied');
  const totalRooms = roomList.length || 1;
  const occupancy = Math.round((occupied / totalRooms) * 100);
  const revenueMonth = resList
    .filter((r) => r.status !== 'cancelled')
    .reduce((s, r) => s + Number(r.total || 0), 0);
  const paidMonth = resList.reduce((s, r) => s + Number(r.amount_paid || 0), 0);

  return {
    totalRooms: roomList.length,
    available: byStatus('available'),
    occupied,
    cleaning: byStatus('cleaning'),
    maintenance: byStatus('maintenance') + byStatus('out_of_service'),
    reserved: byStatus('reserved'),
    occupancy,
    arrivals,
    departures,
    reservationsActive: resList.filter((r) =>
      ['pending', 'confirmed', 'in_progress', 'arrived'].includes(r.status),
    ).length,
    revenueMonth,
    paidMonth,
    housekeepingPending: (hk || []).length,
    maintenanceOpen: (maint || []).length,
  };
}

export async function listHousekeeping(establishmentId: string) {
  const { data, error } = await supabase
    .from('hotel_housekeeping')
    .select('*, hotel_rooms(number)')
    .eq('establishment_id', establishmentId)
    .order('created_at', { ascending: false })
    .limit(100);
  return { data: data || [], error: error?.message };
}

export async function updateHousekeepingStatus(
  id: string,
  status: 'pending' | 'in_progress' | 'done' | 'inspected',
  roomId?: string | null,
) {
  const { error } = await supabase
    .from('hotel_housekeeping')
    .update({
      status,
      completed_at: status === 'done' || status === 'inspected' ? new Date().toISOString() : null,
    })
    .eq('id', id);
  if (!error && roomId && (status === 'done' || status === 'inspected')) {
    await updateRoomStatus(roomId, 'available');
  }
  return { error: error?.message };
}

export async function listMaintenance(establishmentId: string) {
  const { data, error } = await supabase
    .from('hotel_maintenance')
    .select('*, hotel_rooms(number)')
    .eq('establishment_id', establishmentId)
    .order('created_at', { ascending: false })
    .limit(100);
  return { data: data || [], error: error?.message };
}

export async function createMaintenance(
  establishmentId: string,
  input: {
    title: string;
    description?: string;
    priority?: string;
    room_id?: string | null;
    created_by?: string;
  },
) {
  const { data, error } = await supabase
    .from('hotel_maintenance')
    .insert({
      establishment_id: establishmentId,
      title: input.title,
      description: input.description || null,
      priority: input.priority || 'medium',
      room_id: input.room_id || null,
      created_by: input.created_by || null,
      status: 'open',
    })
    .select()
    .single();
  if (!error && input.room_id) {
    await updateRoomStatus(input.room_id, 'maintenance');
  }
  return { data, error: error?.message };
}

export async function updateMaintenanceStatus(
  id: string,
  status: 'open' | 'in_progress' | 'done' | 'cancelled',
  roomId?: string | null,
) {
  const { error } = await supabase
    .from('hotel_maintenance')
    .update({
      status,
      completed_at: status === 'done' ? new Date().toISOString() : null,
    })
    .eq('id', id);
  if (!error && roomId && status === 'done') {
    await updateRoomStatus(roomId, 'available');
  }
  return { error: error?.message };
}

export async function listEvents(establishmentId: string) {
  const { data, error } = await supabase
    .from('hotel_events')
    .select('*')
    .eq('establishment_id', establishmentId)
    .order('event_date', { ascending: false })
    .limit(100);
  return { data: data || [], error: error?.message };
}

export async function createEvent(
  establishmentId: string,
  input: {
    hall_name: string;
    event_name: string;
    client_name?: string;
    client_phone?: string;
    event_date?: string;
    capacity?: number;
    rate?: number;
    deposit?: number;
    total?: number;
    notes?: string;
  },
) {
  const { data, error } = await supabase
    .from('hotel_events')
    .insert({
      establishment_id: establishmentId,
      hall_name: input.hall_name,
      event_name: input.event_name,
      client_name: input.client_name || null,
      client_phone: input.client_phone || null,
      event_date: input.event_date || null,
      capacity: input.capacity || null,
      rate: input.rate ?? 0,
      deposit: input.deposit ?? 0,
      total: input.total ?? input.rate ?? 0,
      notes: input.notes || null,
      status: 'confirmed',
    })
    .select()
    .single();
  return { data, error: error?.message };
}

export async function getComplexSettings(establishmentId: string) {
  const { data, error } = await supabase
    .from('hotel_complex_settings')
    .select('*')
    .eq('establishment_id', establishmentId)
    .maybeSingle();
  return { data, error: error?.message };
}

export async function saveComplexSettings(
  establishmentId: string,
  input: Record<string, unknown>,
) {
  const { data, error } = await supabase
    .from('hotel_complex_settings')
    .upsert(
      {
        establishment_id: establishmentId,
        ...input,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'establishment_id' },
    )
    .select()
    .single();
  return { data, error: error?.message };
}

export function formatFcfa(n: number) {
  return `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
}
