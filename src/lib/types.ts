export type Role = 'super_admin' | 'admin' | 'owner' | 'manager' | 'cashier' | 'employee';

export type MemberStatus = 'active' | 'suspended';

export type AccessRequestStatus = 'pending' | 'approved' | 'rejected';

export type PaymentMethod = 'cash' | 'mobile_money' | 'orange_money' | 'mtn_money' | 'moov_money' | 'wave' | 'card' | 'ardoise' | 'other';

export interface Establishment {
  id: string;
  name: string;
  type: string;
  address: string | null;
  phone: string | null;
  created_by: string | null;
  created_at: string;
  logo_url?: string | null;
  subscription_status?: string | null;
  trial_ends_at?: string | null;
  subscription_ends_at?: string | null;
  last_payment_at?: string | null;
  /** GPS — position partagée avec consentement */
  latitude?: number | null;
  longitude?: number | null;
  location_updated_at?: string | null;
  location_consent?: boolean | null;
}

export interface Member {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: Role;
  establishment_id: string | null;
  status: MemberStatus;
  created_at: string;
  last_seen?: string | null;
  /** Autorisé par le propriétaire à modifier le stock */
  can_edit_stock?: boolean | null;
}

export interface Product {
  id: string;
  establishment_id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  min_stock: number;
  unit: string;
  created_at: string;
  image_url?: string | null;
  /** Unités par casier/pack (ex: 12 ou 24) */
  units_per_package?: number | null;
  /** Valeur caution bouteille (FCFA) */
  consigne_unit?: number | null;
  /** Bouteilles vides en réserve */
  empty_bottles?: number | null;
}

export interface Sale {
  id: string;
  establishment_id: string;
  product_id: string | null;
  qty: number;
  unit_price: number;
  total: number;
  payment_method: PaymentMethod;
  created_by: string | null;
  created_at: string;
}

export interface DailyReport {
  id: string;
  establishment_id: string;
  date: string;
  total_sales: number;
  total_expenses: number;
  cash: number;
  mobile_money: number;
  losses: number;
  broken: number;
  notes: string | null;
  signature: string | null;
  locked: boolean;
  locked_at: string | null;
  locked_by: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  establishment_id: string;
  category: string;
  description: string | null;
  amount: number;
  payment_method: PaymentMethod;
  created_by: string | null;
  created_at: string;
}

export interface Employee {
  id: string;
  establishment_id: string;
  name: string;
  role: string;
  phone: string | null;
  salary: number;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string | null;
  read: boolean;
  created_at: string;
  link?: string | null;
  action_label?: string | null;
  type?: string | null;
}

export interface AccessRequest {
  id: string;
  email: string;
  full_name: string | null;
  auth_provider: 'email' | 'google';
  user_id: string | null;
  status: AccessRequestStatus;
  created_at: string;
}

export interface Supplier {
  id: string;
  establishment_id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

export interface Purchase {
  id: string;
  establishment_id: string;
  supplier_id: string | null;
  product_id: string | null;
  qty: number;
  unit_cost: number;
  total: number;
  status: 'ordered' | 'received' | 'cancelled';
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  establishment_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  loyalty_points: number;
  total_visits: number;
  total_spent: number;
  notes: string | null;
  created_at: string;
}

export interface RestaurantTable {
  id: string;
  establishment_id: string;
  number: string;
  seats: number;
  status: 'free' | 'occupied' | 'reserved';
  location: string;
  created_at: string;
}

export interface Order {
  id: string;
  establishment_id: string;
  table_id: string | null;
  table_number: string | null;
  status: 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
  order_type: 'dine_in' | 'takeaway' | 'delivery';
  total: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  qty: number;
  unit_price: number;
  status: 'pending' | 'preparing' | 'ready' | 'served';
  created_at: string;
}

export interface Shift {
  id: string;
  establishment_id: string;
  employee_id: string;
  start_time: string;
  end_time: string | null;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
}

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Administrateur',
  admin: 'Administrateur',
  owner: 'Propriétaire',
  manager: 'Gérant',
  cashier: 'Caissier',
  employee: 'Employé',
};

/** Hiérarchie : plus le chiffre est bas, plus le rôle est élevé */
export const ROLE_RANK: Record<Role, number> = {
  super_admin: 0,
  admin: 1,
  owner: 2,
  manager: 3,
  cashier: 4,
  employee: 5,
};

export const EXPENSE_CATEGORIES = [
  'Achats',
  'Loyer',
  'Salaires',
  'Électricité',
  'Eau',
  'Gaz',
  'Transport',
  'Maintenance',
  'Marketing',
  'Taxes',
  'Autre',
] as const;

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  preparing: 'En préparation',
  ready: 'Prêt',
  served: 'Servi',
  cancelled: 'Annulé',
};

export const ORDER_TYPE_LABELS: Record<string, string> = {
  dine_in: 'Sur place',
  takeaway: 'À emporter',
  delivery: 'Livraison',
};
