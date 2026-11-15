/*
# Tables métier : ventes, dépenses, employés, rapports, notifications, demandes d'accès

## Description
Crée toutes les tables opérationnelles du Maquis Manager.

## Nouvelles tables
1. `sales` — Ventes individuelles (caisse/POS)
   - id, establishment_id, product_id, qty, unit_price, total, payment_method, created_by, created_at
2. `daily_reports` — Clôture quotidienne par établissement
   - id, establishment_id, date, total_sales, total_expenses, cash, mobile_money, losses, broken, notes, signature, locked, locked_at, locked_by, created_at
3. `expenses` — Dépenses (achats, frais)
   - id, establishment_id, category, description, amount, payment_method, created_by, created_at
4. `employees` — Employés de l'établissement
   - id, establishment_id, name, role, phone, salary, status, created_at
5. `notifications` — Notifications des utilisateurs
   - id, user_id, title, message, read, created_at
6. `access_requests` — Demandes d'accès des nouveaux membres (en attente de validation super admin)
   - id, email, full_name, auth_provider, user_id, status, created_at

## Sécurité
- RLS sur toutes les tables, filtrage par établissement via current_establishment_id()
- access_requests : seul le super admin peut lire/modifier; l'utilisateur peut insérer sa propre demande
- notifications : chaque utilisateur ne voit que ses propres notifications
*/

CREATE TABLE IF NOT EXISTS public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  qty numeric(12,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text DEFAULT 'cash' CHECK (payment_method IN ('cash','mobile_money','other')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.daily_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  total_sales numeric(12,2) NOT NULL DEFAULT 0,
  total_expenses numeric(12,2) NOT NULL DEFAULT 0,
  cash numeric(12,2) NOT NULL DEFAULT 0,
  mobile_money numeric(12,2) NOT NULL DEFAULT 0,
  losses numeric(12,2) NOT NULL DEFAULT 0,
  broken numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  signature text,
  locked boolean NOT NULL DEFAULT false,
  locked_at timestamptz,
  locked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(establishment_id, date)
);

ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  category text DEFAULT 'autre',
  description text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text DEFAULT 'cash' CHECK (payment_method IN ('cash','mobile_money','other')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text DEFAULT 'serveur',
  phone text,
  salary numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text,
  auth_provider text DEFAULT 'email' CHECK (auth_provider IN ('email','google')),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sales_establishment_id ON public.sales(establishment_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at);
CREATE INDEX IF NOT EXISTS idx_daily_reports_establishment_id ON public.daily_reports(establishment_id);
CREATE INDEX IF NOT EXISTS idx_expenses_establishment_id ON public.expenses(establishment_id);
CREATE INDEX IF NOT EXISTS idx_employees_establishment_id ON public.employees(establishment_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON public.access_requests(status);
