-- Phase A : commandes QR table (insert public, lecture staff)
-- orders / order_items / restaurant_tables

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS table_number text;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_orders_qr" ON public.orders;
CREATE POLICY "anon_insert_orders_qr" ON public.orders
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon_insert_order_items_qr" ON public.order_items;
CREATE POLICY "anon_insert_order_items_qr" ON public.order_items
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_tables_qr" ON public.restaurant_tables;
CREATE POLICY "anon_select_tables_qr" ON public.restaurant_tables
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "anon_select_products_menu" ON public.products;
-- lecture produits pour menu commande (prix/stock)
CREATE POLICY "anon_select_products_menu" ON public.products
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "anon_select_est_public" ON public.establishments;
CREATE POLICY "anon_select_est_public" ON public.establishments
  FOR SELECT TO anon, authenticated
  USING (true);
