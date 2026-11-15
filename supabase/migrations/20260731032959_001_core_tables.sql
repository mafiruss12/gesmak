/*
# Création des tables principales : établissements, membres, produits

## Description
Crée le cœur du schéma pour l'application Maquis Manager :
- Les établissements (maquis/restaurants)
- Les membres (utilisateurs) avec rôles et établissement
- Les produits/inventaire

## Nouvelles tables
1. `establishments` — id, name, type, address, phone, created_by, created_at
2. `members` — id, user_id, email, full_name, role, establishment_id, status, created_at
   - 5 rôles : super_admin, admin, manager, cashier, employee
3. `products` — id, establishment_id, name, category, price, cost, stock, min_stock, unit, created_at

## Notes
- Les fonctions helper sont créées dans la migration suivante (après les tables)
- RLS activée sur toutes les tables, politiques ajoutées dans la migration suivante
*/

CREATE TABLE IF NOT EXISTS public.establishments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text DEFAULT 'maquis',
  address text,
  phone text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.establishments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'employee' CHECK (role IN ('super_admin','admin','manager','cashier','employee')),
  establishment_id uuid REFERENCES public.establishments(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text DEFAULT 'autre',
  price numeric(12,2) NOT NULL DEFAULT 0,
  cost numeric(12,2) NOT NULL DEFAULT 0,
  stock numeric(12,2) NOT NULL DEFAULT 0,
  min_stock numeric(12,2) NOT NULL DEFAULT 0,
  unit text DEFAULT 'unité',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_members_user_id ON public.members(user_id);
CREATE INDEX IF NOT EXISTS idx_members_establishment_id ON public.members(establishment_id);
CREATE INDEX IF NOT EXISTS idx_products_establishment_id ON public.products(establishment_id);
