-- Payment requests (manual MoMo + WhatsApp) + server-side plan limits
-- Safe: IF NOT EXISTS / CREATE OR REPLACE

CREATE TABLE IF NOT EXISTS public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  plan_tier text NOT NULL DEFAULT 'starter'
    CHECK (plan_tier IN ('starter', 'pro', 'business')),
  months int NOT NULL DEFAULT 1 CHECK (months >= 1 AND months <= 60),
  amount_fcfa int NOT NULL CHECK (amount_fcfa > 0),
  payment_method text NOT NULL DEFAULT 'whatsapp',
  reference_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  proof_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid
);

CREATE INDEX IF NOT EXISTS idx_payment_requests_est ON public.payment_requests(establishment_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON public.payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_user ON public.payment_requests(user_id);

ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

-- Helpers: membership check without recursion issues
CREATE OR REPLACE FUNCTION public.is_est_owner_or_manager(p_est uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.establishment_id = p_est
      AND m.role IN ('owner', 'manager', 'admin', 'super_admin')
  ) OR public.is_super_admin();
$$;

DROP POLICY IF EXISTS payment_requests_select ON public.payment_requests;
CREATE POLICY payment_requests_select ON public.payment_requests
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR user_id = auth.uid()
    OR public.is_est_owner_or_manager(establishment_id)
  );

DROP POLICY IF EXISTS payment_requests_insert ON public.payment_requests;
CREATE POLICY payment_requests_insert ON public.payment_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_est_owner_or_manager(establishment_id)
  );

DROP POLICY IF EXISTS payment_requests_update_admin ON public.payment_requests;
CREATE POLICY payment_requests_update_admin ON public.payment_requests
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Effective plan tier for limits (trial => pro)
CREATE OR REPLACE FUNCTION public.effective_plan_tier(p_est uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  st text;
  tier text;
  trial_end timestamptz;
BEGIN
  SELECT subscription_status, plan_tier, trial_ends_at
    INTO st, tier, trial_end
  FROM public.establishments WHERE id = p_est;

  IF st IS NULL OR st = 'trial' THEN
    IF trial_end IS NULL OR trial_end >= now() THEN
      RETURN 'pro';
    END IF;
  END IF;

  IF tier IN ('pro', 'business', 'starter') THEN
    RETURN tier;
  END IF;
  RETURN 'starter';
END;
$$;

CREATE OR REPLACE FUNCTION public.plan_max_products(p_tier text)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_tier
    WHEN 'business' THEN 5000
    WHEN 'pro' THEN 500
    ELSE 80
  END;
$$;

CREATE OR REPLACE FUNCTION public.plan_max_employees(p_tier text)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_tier
    WHEN 'business' THEN 100
    WHEN 'pro' THEN 8
    ELSE 3
  END;
$$;

CREATE OR REPLACE FUNCTION public.assert_can_add_product(p_est uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tier text;
  max_p int;
  cnt int;
BEGIN
  tier := public.effective_plan_tier(p_est);
  max_p := public.plan_max_products(tier);
  SELECT count(*)::int INTO cnt FROM public.products WHERE establishment_id = p_est;
  IF cnt >= max_p THEN
    RAISE EXCEPTION 'PLAN_LIMIT_PRODUCTS: maximum % produits pour le forfait %', max_p, tier
      USING ERRCODE = 'P0001';
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_can_add_member(p_est uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tier text;
  max_e int;
  cnt int;
BEGIN
  tier := public.effective_plan_tier(p_est);
  max_e := public.plan_max_employees(tier);
  SELECT count(*)::int INTO cnt FROM public.members
   WHERE establishment_id = p_est
     AND role IN ('manager', 'cashier', 'employee');
  IF cnt >= max_e THEN
    RAISE EXCEPTION 'PLAN_LIMIT_EMPLOYEES: maximum % employés pour le forfait %', max_e, tier
      USING ERRCODE = 'P0001';
  END IF;
  RETURN true;
END;
$$;

-- Approve payment (super_admin only)
CREATE OR REPLACE FUNCTION public.approve_payment_request(p_request_id uuid, p_note text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.payment_requests%ROWTYPE;
  new_end timestamptz;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO r FROM public.payment_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF r.status = 'approved' THEN
    RETURN json_build_object('ok', true, 'idempotent', true, 'establishment_id', r.establishment_id);
  END IF;

  IF r.status <> 'pending' THEN
    RAISE EXCEPTION 'invalid_status: %', r.status;
  END IF;

  new_end := now() + make_interval(months => r.months);

  UPDATE public.payment_requests
  SET status = 'approved',
      decided_at = now(),
      decided_by = auth.uid(),
      proof_note = COALESCE(p_note, proof_note)
  WHERE id = p_request_id;

  UPDATE public.establishments
  SET plan_tier = r.plan_tier,
      subscription_status = 'active',
      subscription_ends_at = new_end,
      last_payment_at = now()
  WHERE id = r.establishment_id;

  RETURN json_build_object(
    'ok', true,
    'establishment_id', r.establishment_id,
    'plan_tier', r.plan_tier,
    'subscription_ends_at', new_end
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_payment_request(p_request_id uuid, p_note text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.payment_requests
  SET status = 'rejected',
      decided_at = now(),
      decided_by = auth.uid(),
      proof_note = COALESCE(p_note, proof_note)
  WHERE id = p_request_id AND status = 'pending';

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_payment_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_payment_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assert_can_add_product(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assert_can_add_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.effective_plan_tier(uuid) TO authenticated;
