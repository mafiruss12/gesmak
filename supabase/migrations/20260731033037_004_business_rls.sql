/*
# Politiques RLS pour les tables métier

## Description
Applique les politiques RLS sur sales, daily_reports, expenses, employees, notifications, access_requests.

## Sécurité
- sales/daily_reports/expenses/employees : filtrage par établissement
- notifications : chaque utilisateur ne voit que les siennes
- access_requests : seul le super admin lit/modifie; l'utilisateur peut insérer sa propre demande
*/

-- ============ SALES ============
DROP POLICY IF EXISTS "select_sales" ON public.sales;
CREATE POLICY "select_sales" ON public.sales
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id());

DROP POLICY IF EXISTS "insert_sales" ON public.sales;
CREATE POLICY "insert_sales" ON public.sales
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR establishment_id = public.current_establishment_id());

DROP POLICY IF EXISTS "update_sales" ON public.sales;
CREATE POLICY "update_sales" ON public.sales
  FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id())
  WITH CHECK (public.is_super_admin() OR establishment_id = public.current_establishment_id());

DROP POLICY IF EXISTS "delete_sales" ON public.sales;
CREATE POLICY "delete_sales" ON public.sales
  FOR DELETE TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id());

-- ============ DAILY_REPORTS ============
DROP POLICY IF EXISTS "select_daily_reports" ON public.daily_reports;
CREATE POLICY "select_daily_reports" ON public.daily_reports
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id());

DROP POLICY IF EXISTS "insert_daily_reports" ON public.daily_reports;
CREATE POLICY "insert_daily_reports" ON public.daily_reports
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR establishment_id = public.current_establishment_id());

DROP POLICY IF EXISTS "update_daily_reports" ON public.daily_reports;
CREATE POLICY "update_daily_reports" ON public.daily_reports
  FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id())
  WITH CHECK (public.is_super_admin() OR establishment_id = public.current_establishment_id());

DROP POLICY IF EXISTS "delete_daily_reports" ON public.daily_reports;
CREATE POLICY "delete_daily_reports" ON public.daily_reports
  FOR DELETE TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id());

-- ============ EXPENSES ============
DROP POLICY IF EXISTS "select_expenses" ON public.expenses;
CREATE POLICY "select_expenses" ON public.expenses
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id());

DROP POLICY IF EXISTS "insert_expenses" ON public.expenses;
CREATE POLICY "insert_expenses" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR establishment_id = public.current_establishment_id());

DROP POLICY IF EXISTS "update_expenses" ON public.expenses;
CREATE POLICY "update_expenses" ON public.expenses
  FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id())
  WITH CHECK (public.is_super_admin() OR establishment_id = public.current_establishment_id());

DROP POLICY IF EXISTS "delete_expenses" ON public.expenses;
CREATE POLICY "delete_expenses" ON public.expenses
  FOR DELETE TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id());

-- ============ EMPLOYEES ============
DROP POLICY IF EXISTS "select_employees" ON public.employees;
CREATE POLICY "select_employees" ON public.employees
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id());

DROP POLICY IF EXISTS "insert_employees" ON public.employees;
CREATE POLICY "insert_employees" ON public.employees
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR establishment_id = public.current_establishment_id());

DROP POLICY IF EXISTS "update_employees" ON public.employees;
CREATE POLICY "update_employees" ON public.employees
  FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id())
  WITH CHECK (public.is_super_admin() OR establishment_id = public.current_establishment_id());

DROP POLICY IF EXISTS "delete_employees" ON public.employees;
CREATE POLICY "delete_employees" ON public.employees
  FOR DELETE TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id());

-- ============ NOTIFICATIONS ============
DROP POLICY IF EXISTS "select_notifications" ON public.notifications;
CREATE POLICY "select_notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "insert_notifications" ON public.notifications;
CREATE POLICY "insert_notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "update_notifications" ON public.notifications;
CREATE POLICY "update_notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "delete_notifications" ON public.notifications;
CREATE POLICY "delete_notifications" ON public.notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============ ACCESS_REQUESTS ============
DROP POLICY IF EXISTS "select_access_requests" ON public.access_requests;
CREATE POLICY "select_access_requests" ON public.access_requests
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS "insert_access_requests" ON public.access_requests;
CREATE POLICY "insert_access_requests" ON public.access_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "update_access_requests" ON public.access_requests;
CREATE POLICY "update_access_requests" ON public.access_requests
  FOR UPDATE TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "delete_access_requests" ON public.access_requests;
CREATE POLICY "delete_access_requests" ON public.access_requests
  FOR DELETE TO authenticated
  USING (public.is_super_admin());
