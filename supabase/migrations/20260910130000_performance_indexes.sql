-- Indexes performance Stock Manager
CREATE INDEX IF NOT EXISTS idx_products_est_name ON public.products (establishment_id, name);
CREATE INDEX IF NOT EXISTS idx_products_est_category ON public.products (establishment_id, category);
CREATE INDEX IF NOT EXISTS idx_products_est_stock ON public.products (establishment_id, stock);
CREATE INDEX IF NOT EXISTS idx_orders_est_status_created ON public.orders (establishment_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_est_created ON public.orders (establishment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON public.orders (table_id) WHERE table_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.order_items (product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_items_status ON public.order_items (order_id, status);
CREATE INDEX IF NOT EXISTS idx_daily_reports_est_date_desc ON public.daily_reports (establishment_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_est_created_desc ON public.sales (establishment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_est_product ON public.sales (establishment_id, product_id);
CREATE INDEX IF NOT EXISTS idx_expenses_est_created_desc ON public.expenses (establishment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created ON public.notifications (user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_members_est_status_role ON public.members (establishment_id, status, role);
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_est_number ON public.restaurant_tables (establishment_id, number);
CREATE INDEX IF NOT EXISTS idx_stock_proof_est_taken ON public.stock_proof_photos (establishment_id, taken_at DESC);
