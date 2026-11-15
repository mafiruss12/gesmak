-- P3/P5 suite : helpers membership + search_path sécurisé + policies produits/ventes/rapports
-- Pattern : super_admin OU membership member_establishments OU current_establishment_id()

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members
    WHERE user_id = auth.uid()
      AND role = 'super_admin'
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_establishment_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT establishment_id FROM public.members
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_member_of(est_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    est_id IS NOT NULL
    AND (
      public.is_super_admin()
      OR est_id = public.current_establishment_id()
      OR EXISTS (
        SELECT 1 FROM public.member_establishments me
        WHERE me.user_id = auth.uid()
          AND me.establishment_id = est_id
          AND COALESCE(me.status, 'active') = 'active'
      )
    );
$$;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_establishment_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_member_of(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_establishment_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_member_of(uuid) TO authenticated;

-- PRODUCTS (écriture restreinte membership)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='products') THEN
    EXECUTE 'DROP POLICY IF EXISTS select_products ON public.products';
    EXECUTE 'DROP POLICY IF EXISTS "select_products" ON public.products';
    EXECUTE 'CREATE POLICY select_products ON public.products FOR SELECT TO authenticated USING (public.is_member_of(establishment_id))';

    EXECUTE 'DROP POLICY IF EXISTS insert_products ON public.products';
    EXECUTE 'DROP POLICY IF EXISTS "insert_products" ON public.products';
    EXECUTE 'CREATE POLICY insert_products ON public.products FOR INSERT TO authenticated WITH CHECK (public.is_member_of(establishment_id))';

    EXECUTE 'DROP POLICY IF EXISTS update_products ON public.products';
    EXECUTE 'DROP POLICY IF EXISTS "update_products" ON public.products';
    EXECUTE 'CREATE POLICY update_products ON public.products FOR UPDATE TO authenticated USING (public.is_member_of(establishment_id)) WITH CHECK (public.is_member_of(establishment_id))';

    EXECUTE 'DROP POLICY IF EXISTS delete_products ON public.products';
    EXECUTE 'DROP POLICY IF EXISTS "delete_products" ON public.products';
    EXECUTE 'CREATE POLICY delete_products ON public.products FOR DELETE TO authenticated USING (public.is_member_of(establishment_id))';
  END IF;
END $$;

-- SALES
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='sales') THEN
    EXECUTE 'DROP POLICY IF EXISTS select_sales ON public.sales';
    EXECUTE 'DROP POLICY IF EXISTS "select_sales" ON public.sales';
    EXECUTE 'CREATE POLICY select_sales ON public.sales FOR SELECT TO authenticated USING (public.is_member_of(establishment_id))';

    EXECUTE 'DROP POLICY IF EXISTS insert_sales ON public.sales';
    EXECUTE 'DROP POLICY IF EXISTS "insert_sales" ON public.sales';
    EXECUTE 'CREATE POLICY insert_sales ON public.sales FOR INSERT TO authenticated WITH CHECK (public.is_member_of(establishment_id))';

    EXECUTE 'DROP POLICY IF EXISTS update_sales ON public.sales';
    EXECUTE 'DROP POLICY IF EXISTS "update_sales" ON public.sales';
    EXECUTE 'CREATE POLICY update_sales ON public.sales FOR UPDATE TO authenticated USING (public.is_member_of(establishment_id)) WITH CHECK (public.is_member_of(establishment_id))';

    EXECUTE 'DROP POLICY IF EXISTS delete_sales ON public.sales';
    EXECUTE 'DROP POLICY IF EXISTS "delete_sales" ON public.sales';
    EXECUTE 'CREATE POLICY delete_sales ON public.sales FOR DELETE TO authenticated USING (public.is_member_of(establishment_id))';
  END IF;
END $$;

-- DAILY_REPORTS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='daily_reports') THEN
    EXECUTE 'DROP POLICY IF EXISTS select_daily_reports ON public.daily_reports';
    EXECUTE 'DROP POLICY IF EXISTS "select_daily_reports" ON public.daily_reports';
    EXECUTE 'CREATE POLICY select_daily_reports ON public.daily_reports FOR SELECT TO authenticated USING (public.is_member_of(establishment_id))';

    EXECUTE 'DROP POLICY IF EXISTS insert_daily_reports ON public.daily_reports';
    EXECUTE 'DROP POLICY IF EXISTS "insert_daily_reports" ON public.daily_reports';
    EXECUTE 'CREATE POLICY insert_daily_reports ON public.daily_reports FOR INSERT TO authenticated WITH CHECK (public.is_member_of(establishment_id))';

    EXECUTE 'DROP POLICY IF EXISTS update_daily_reports ON public.daily_reports';
    EXECUTE 'DROP POLICY IF EXISTS "update_daily_reports" ON public.daily_reports';
    EXECUTE 'CREATE POLICY update_daily_reports ON public.daily_reports FOR UPDATE TO authenticated USING (public.is_member_of(establishment_id)) WITH CHECK (public.is_member_of(establishment_id))';

    EXECUTE 'DROP POLICY IF EXISTS delete_daily_reports ON public.daily_reports';
    EXECUTE 'DROP POLICY IF EXISTS "delete_daily_reports" ON public.daily_reports';
    EXECUTE 'CREATE POLICY delete_daily_reports ON public.daily_reports FOR DELETE TO authenticated USING (public.is_member_of(establishment_id))';
  END IF;
END $$;

-- EXPENSES
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='expenses') THEN
    EXECUTE 'DROP POLICY IF EXISTS select_expenses ON public.expenses';
    EXECUTE 'DROP POLICY IF EXISTS "select_expenses" ON public.expenses';
    EXECUTE 'CREATE POLICY select_expenses ON public.expenses FOR SELECT TO authenticated USING (public.is_member_of(establishment_id))';

    EXECUTE 'DROP POLICY IF EXISTS insert_expenses ON public.expenses';
    EXECUTE 'DROP POLICY IF EXISTS "insert_expenses" ON public.expenses';
    EXECUTE 'CREATE POLICY insert_expenses ON public.expenses FOR INSERT TO authenticated WITH CHECK (public.is_member_of(establishment_id))';

    EXECUTE 'DROP POLICY IF EXISTS update_expenses ON public.expenses';
    EXECUTE 'DROP POLICY IF EXISTS "update_expenses" ON public.expenses';
    EXECUTE 'CREATE POLICY update_expenses ON public.expenses FOR UPDATE TO authenticated USING (public.is_member_of(establishment_id)) WITH CHECK (public.is_member_of(establishment_id))';

    EXECUTE 'DROP POLICY IF EXISTS delete_expenses ON public.expenses';
    EXECUTE 'DROP POLICY IF EXISTS "delete_expenses" ON public.expenses';
    EXECUTE 'CREATE POLICY delete_expenses ON public.expenses FOR DELETE TO authenticated USING (public.is_member_of(establishment_id))';
  END IF;
END $$;

COMMENT ON FUNCTION public.is_member_of(uuid) IS 'True si auth.uid() est super_admin ou membre actif de l’établissement (members ou member_establishments)';
