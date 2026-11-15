export interface RentalEquipment {
  id: string;
  establishment_id: string;
  category: string;
  name: string;
  description: string | null;
  qty_total: number;
  qty_available: number;
  qty_reserved: number;
  qty_out: number;
  qty_damaged: number;
  unit_price: number;
  created_at: string;
}

export interface RentalClient {
  id: string;
  establishment_id: string;
  full_name: string;
  phone: string | null;
  location: string | null;
  whatsapp?: string | null;
  email?: string | null;
  notes: string | null;
  created_at: string;
}

export type RentalOrderStatus = 'draft' | 'confirmed' | 'out' | 'returned' | 'cancelled';

export interface RentalOrder {
  id: string;
  establishment_id: string;
  client_id: string | null;
  client_name: string | null;
  client_phone: string | null;
  event_date: string | null;
  return_date: string | null;
  status: RentalOrderStatus;
  total_amount: number;
  deposit_amount: number;
  paid_amount: number;
  caution_amount?: number;
  caution_returned?: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RentalOrderItem {
  id: string;
  order_id: string;
  equipment_id: string | null;
  equipment_name: string;
  qty: number;
  unit_price: number;
  line_total: number;
}

export interface RentalPayment {
  id: string;
  establishment_id: string;
  order_id: string;
  amount: number;
  method: string;
  note: string | null;
  created_at: string;
}

export interface RentalMovement {
  id: string;
  establishment_id: string;
  order_id: string;
  type: 'out' | 'return';
  responsible: string | null;
  moved_at: string;
  notes: string | null;
  items: unknown;
}

export interface RentalPack {
  id: string;
  establishment_id: string;
  name: string;
  event_type: string | null;
  guests: number;
  description: string | null;
  items: { name: string; category?: string; qty: number; unit_price?: number }[];
  created_at: string;
}

export function orderBalance(o: Pick<RentalOrder, 'total_amount' | 'paid_amount'>): number {
  return Math.max(0, Number(o.total_amount) - Number(o.paid_amount));
}
