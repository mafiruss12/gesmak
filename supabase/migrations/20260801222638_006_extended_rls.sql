/*
# RLS pour les tables étendues
*/

-- SUPPLIERS
DROP POLICY IF EXISTS "select_suppliers" ON public.suppliers;
CREATE POLICY "select_suppliers" ON public.suppliers FOR SELECT TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id());
DROP POLICY IF EXISTS "insert_suppliers" ON public.suppliers;
CREATE POLICY "insert_suppliers" ON public.suppliers FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR establishment_id = public.current_establishment_id());
DROP POLICY IF EXISTS "update_suppliers" ON public.suppliers;
CREATE POLICY "update_suppliers" ON public.suppliers FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id())
  WITH CHECK (public.is_super_admin() OR establishment_id = public.current_establishment_id());
DROP POLICY IF EXISTS "delete_suppliers" ON public.suppliers;
CREATE POLICY "delete_suppliers" ON public.suppliers FOR DELETE TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id());

-- PURCHASES
DROP POLICY IF EXISTS "select_purchases" ON public.purchases;
CREATE POLICY "select_purchases" ON public.purchases FOR SELECT TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id());
DROP POLICY IF EXISTS "insert_purchases" ON public.purchases;
CREATE POLICY "insert_purchases" ON public.purchases FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR establishment_id = public.current_establishment_id());
DROP POLICY IF EXISTS "update_purchases" ON public.purchases;
CREATE POLICY "update_purchases" ON public.purchases FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id())
  WITH CHECK (public.is_super_admin() OR establishment_id = public.current_establishment_id());
DROP POLICY IF EXISTS "delete_purchases" ON public.purchases;
CREATE POLICY "delete_purchases" ON public.purchases FOR DELETE TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id());

-- CUSTOMERS
DROP POLICY IF EXISTS "select_customers" ON public.customers;
CREATE POLICY "select_customers" ON public.customers FOR SELECT TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id());
DROP POLICY IF EXISTS "insert_customers" ON public.customers;
CREATE POLICY "insert_customers" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR establishment_id = public.current_establishment_id());
DROP POLICY IF EXISTS "update_customers" ON public.customers;
CREATE POLICY "update_customers" ON public.customers FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id())
  WITH CHECK (public.is_super_admin() OR establishment_id = public.current_establishment_id());
DROP POLICY IF EXISTS "delete_customers" ON public.customers;
CREATE POLICY "delete_customers" ON public.customers FOR DELETE TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id());

-- RESTAURANT_TABLES
DROP POLICY IF EXISTS "select_restaurant_tables" ON public.restaurant_tables;
CREATE POLICY "select_restaurant_tables" ON public.restaurant_tables FOR SELECT TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id());
DROP POLICY IF EXISTS "insert_restaurant_tables" ON public.restaurant_tables;
CREATE POLICY "insert_restaurant_tables" ON public.restaurant_tables FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR establishment_id = public.current_establishment_id());
DROP POLICY IF EXISTS "update_restaurant_tables" ON public.restaurant_tables;
CREATE POLICY "update_restaurant_tables" ON public.restaurant_tables FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id())
  WITH CHECK (public.is_super_admin() OR establishment_id = public.current_establishment_id());
DROP POLICY IF EXISTS "delete_restaurant_tables" ON public.restaurant_tables;
CREATE POLICY "delete_restaurant_tables" ON public.restaurant_tables FOR DELETE TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id());

-- ORDERS
DROP POLICY IF EXISTS "select_orders" ON public.orders;
CREATE POLICY "select_orders" ON public.orders FOR SELECT TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id());
DROP POLICY IF EXISTS "insert_orders" ON public.orders;
CREATE POLICY "insert_orders" ON public.orders FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR establishment_id = public.current_establishment_id());
DROP POLICY IF EXISTS "update_orders" ON public.orders;
CREATE POLICY "update_orders" ON public.orders FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id())
  WITH CHECK (public.is_super_admin() OR establishment_id = public.current_establishment_id());
DROP POLICY IF EXISTS "delete_orders" ON public.orders;
CREATE POLICY "delete_orders" ON public.orders FOR DELETE TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id());

-- ORDER_ITEMS
DROP POLICY IF EXISTS "select_order_items" ON public.order_items;
CREATE POLICY "select_order_items" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (public.is_super_admin() OR o.establishment_id = public.current_establishment_id())));
DROP POLICY IF EXISTS "insert_order_items" ON public.order_items;
CREATE POLICY "insert_order_items" ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (public.is_super_admin() OR o.establishment_id = public.current_establishment_id())));
DROP POLICY IF EXISTS "update_order_items" ON public.order_items;
CREATE POLICY "update_order_items" ON public.order_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (public.is_super_admin() OR o.establishment_id = public.current_establishment_id())));
DROP POLICY IF EXISTS "delete_order_items" ON public.order_items;
CREATE POLICY "delete_order_items" ON public.order_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (public.is_super_admin() OR o.establishment_id = public.current_establishment_id())));

-- SHIFTS
DROP POLICY IF EXISTS "select_shifts" ON public.shifts;
CREATE POLICY "select_shifts" ON public.shifts FOR SELECT TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id());
DROP POLICY IF EXISTS "insert_shifts" ON public.shifts;
CREATE POLICY "insert_shifts" ON public.shifts FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR establishment_id = public.current_establishment_id());
DROP POLICY IF EXISTS "update_shifts" ON public.shifts;
CREATE POLICY "update_shifts" ON public.shifts FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id())
  WITH CHECK (public.is_super_admin() OR establishment_id = public.current_establishment_id());
DROP POLICY IF EXISTS "delete_shifts" ON public.shifts;
CREATE POLICY "delete_shifts" ON public.shifts FOR DELETE TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id());

-- MENU_CATEGORIES
DROP POLICY IF EXISTS "select_menu_categories" ON public.menu_categories;
CREATE POLICY "select_menu_categories" ON public.menu_categories FOR SELECT TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id());
DROP POLICY IF EXISTS "insert_menu_categories" ON public.menu_categories;
CREATE POLICY "insert_menu_categories" ON public.menu_categories FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR establishment_id = public.current_establishment_id());
DROP POLICY IF EXISTS "update_menu_categories" ON public.menu_categories;
CREATE POLICY "update_menu_categories" ON public.menu_categories FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id())
  WITH CHECK (public.is_super_admin() OR establishment_id = public.current_establishment_id());
DROP POLICY IF EXISTS "delete_menu_categories" ON public.menu_categories;
CREATE POLICY "delete_menu_categories" ON public.menu_categories FOR DELETE TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id());
