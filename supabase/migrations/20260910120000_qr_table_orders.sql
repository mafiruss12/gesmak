-- Commandes QR table : lecture menu + création commande sans login
-- À exécuter dans Supabase SQL Editor si pas déjà appliqué

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS product_name text;

-- Produits visibles pour commander (prix > 0)
DROP POLICY IF EXISTS "anon_select_products_order" ON public.products;
CREATE POLICY "anon_select_products_order" ON public.products
  FOR SELECT TO anon
  USING (COALESCE(price, 0) > 0);

DROP POLICY IF EXISTS "anon_select_est_public" ON public.establishments;
CREATE POLICY "anon_select_est_public" ON public.establishments
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "anon_select_tables" ON public.restaurant_tables;
CREATE POLICY "anon_select_tables" ON public.restaurant_tables
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "anon_update_table_status" ON public.restaurant_tables;
CREATE POLICY "anon_update_table_status" ON public.restaurant_tables
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon_insert_orders" ON public.orders;
CREATE POLICY "anon_insert_orders" ON public.orders
  FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon_insert_order_items" ON public.order_items;
CREATE POLICY "anon_insert_order_items" ON public.order_items
  FOR INSERT TO anon
  WITH CHECK (true);

-- Staff already has policies via authenticated; ensure select for kitchen
DROP POLICY IF EXISTS "auth_select_orders" ON public.orders;
CREATE POLICY "auth_select_orders" ON public.orders
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "auth_update_orders" ON public.orders;
CREATE POLICY "auth_update_orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_order_items" ON public.order_items;
CREATE POLICY "auth_select_order_items" ON public.order_items
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "auth_update_order_items" ON public.order_items;
CREATE POLICY "auth_update_order_items" ON public.order_items
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
