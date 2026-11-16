-- GESMAK Phase 3B.1 — Multi-services / multi-caisses (ADDITIVE ONLY)
-- Branch: feature/gesmak-multi-services
-- DO NOT apply to production without explicit owner validation.
-- No DROP, no DELETE of business data, no rewrite of historical sales.

-- 1) Services within an establishment
CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  is_default boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active'
    CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text])),
  assignment_kind text NOT NULL DEFAULT 'verified_historical'
    CHECK (assignment_kind = ANY (ARRAY[
      'verified_historical'::text,
      'technical_compat'::text,
      'unknown_needs_reconcile'::text
    ])),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (establishment_id, name)
);

CREATE INDEX IF NOT EXISTS idx_services_establishment
  ON public.services (establishment_id);

-- 2) Cash registers attached to a service
CREATE TABLE IF NOT EXISTS public.cash_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active'
    CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text])),
  assignment_kind text NOT NULL DEFAULT 'technical_compat'
    CHECK (assignment_kind = ANY (ARRAY[
      'verified_historical'::text,
      'technical_compat'::text,
      'unknown_needs_reconcile'::text
    ])),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_id, name)
);

CREATE INDEX IF NOT EXISTS idx_cash_registers_est
  ON public.cash_registers (establishment_id);
CREATE INDEX IF NOT EXISTS idx_cash_registers_service
  ON public.cash_registers (service_id);

-- 3) Manager ↔ service assignments
CREATE TABLE IF NOT EXISTS public.service_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'manager'
    CHECK (role = ANY (ARRAY['manager'::text, 'owner'::text])),
  status text NOT NULL DEFAULT 'active'
    CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text])),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_service_assignments_user
  ON public.service_assignments (user_id);

-- 4) Cashier ↔ cash register assignments
CREATE TABLE IF NOT EXISTS public.cash_register_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  cash_register_id uuid NOT NULL REFERENCES public.cash_registers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text])),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cash_register_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cash_register_assignments_user
  ON public.cash_register_assignments (user_id);

-- 5) Extend existing cash_sessions (nullable = legacy safe)
ALTER TABLE public.cash_sessions
  ADD COLUMN IF NOT EXISTS cash_register_id uuid REFERENCES public.cash_registers(id);
ALTER TABLE public.cash_sessions
  ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.services(id);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_register
  ON public.cash_sessions (cash_register_id)
  WHERE cash_register_id IS NOT NULL;

-- Partial unique: at most one open session per cash register (when register set)
CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_sessions_one_open_per_register
  ON public.cash_sessions (cash_register_id)
  WHERE status = 'open' AND cash_register_id IS NOT NULL;

-- Partial unique: at most one open session per opener per establishment
CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_sessions_one_open_per_opener_est
  ON public.cash_sessions (establishment_id, opened_by)
  WHERE status = 'open' AND opened_by IS NOT NULL;

-- 6) Link sales / orders to session (nullable — historical rows stay valid)
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS cash_session_id uuid REFERENCES public.cash_sessions(id);
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cash_session_id uuid REFERENCES public.cash_sessions(id);

CREATE INDEX IF NOT EXISTS idx_sales_cash_session
  ON public.sales (cash_session_id)
  WHERE cash_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_cash_session
  ON public.orders (cash_session_id)
  WHERE cash_session_id IS NOT NULL;

-- 7) Approval requests (anti self-approval at schema level where possible)
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id),
  request_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY[
      'pending'::text, 'approved'::text, 'rejected'::text, 'executed'::text, 'cancelled'::text
    ])),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_by uuid NOT NULL,
  resolved_by uuid,
  executed_by uuid,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  executed_at timestamptz,
  CONSTRAINT approval_no_self_resolve CHECK (
    resolved_by IS NULL OR resolved_by <> requested_by
  )
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_est_status
  ON public.approval_requests (establishment_id, status);

-- 8) Technical default service + register per establishment (compat only)
INSERT INTO public.services (establishment_id, name, code, is_default, assignment_kind)
SELECT e.id, 'Service principal', 'DEFAULT', true, 'technical_compat'
FROM public.establishments e
WHERE NOT EXISTS (
  SELECT 1 FROM public.services s WHERE s.establishment_id = e.id AND s.is_default = true
);

INSERT INTO public.cash_registers (establishment_id, service_id, name, is_default, assignment_kind)
SELECT s.establishment_id, s.id, 'Caisse principale', true, 'technical_compat'
FROM public.services s
WHERE s.is_default = true
  AND NOT EXISTS (
    SELECT 1 FROM public.cash_registers c
    WHERE c.service_id = s.id AND c.is_default = true
  );

-- 9) RLS enable on new tables (membership via members OR member_establishments)
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_register_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

-- Helper expression reused: active membership on establishment
-- Policies: replace if re-run
DO $$
BEGIN
  -- services
  DROP POLICY IF EXISTS services_member_select ON public.services;
  CREATE POLICY services_member_select ON public.services FOR SELECT TO authenticated
  USING (
    establishment_id IN (
      SELECT m.establishment_id FROM public.members m
      WHERE m.user_id = auth.uid() AND m.status = 'active'
    )
    OR establishment_id IN (
      SELECT me.establishment_id FROM public.member_establishments me
      WHERE me.user_id = auth.uid() AND COALESCE(me.status, 'active') = 'active'
    )
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid() AND m.status = 'active'
        AND m.role = ANY (ARRAY['super_admin'::text, 'admin'::text])
    )
  );

  DROP POLICY IF EXISTS services_owner_write ON public.services;
  CREATE POLICY services_owner_write ON public.services FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid() AND m.status = 'active'
        AND m.role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'owner'::text])
        AND (m.role = ANY (ARRAY['super_admin'::text, 'admin'::text]) OR m.establishment_id = services.establishment_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid() AND m.status = 'active'
        AND m.role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'owner'::text])
        AND (m.role = ANY (ARRAY['super_admin'::text, 'admin'::text]) OR m.establishment_id = services.establishment_id)
    )
  );

  -- cash_registers
  DROP POLICY IF EXISTS cash_registers_member_select ON public.cash_registers;
  CREATE POLICY cash_registers_member_select ON public.cash_registers FOR SELECT TO authenticated
  USING (
    establishment_id IN (
      SELECT m.establishment_id FROM public.members m
      WHERE m.user_id = auth.uid() AND m.status = 'active'
    )
    OR establishment_id IN (
      SELECT me.establishment_id FROM public.member_establishments me
      WHERE me.user_id = auth.uid() AND COALESCE(me.status, 'active') = 'active'
    )
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid() AND m.status = 'active'
        AND m.role = ANY (ARRAY['super_admin'::text, 'admin'::text])
    )
  );

  DROP POLICY IF EXISTS cash_registers_owner_write ON public.cash_registers;
  CREATE POLICY cash_registers_owner_write ON public.cash_registers FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid() AND m.status = 'active'
        AND m.role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'owner'::text])
        AND (m.role = ANY (ARRAY['super_admin'::text, 'admin'::text]) OR m.establishment_id = cash_registers.establishment_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid() AND m.status = 'active'
        AND m.role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'owner'::text])
        AND (m.role = ANY (ARRAY['super_admin'::text, 'admin'::text]) OR m.establishment_id = cash_registers.establishment_id)
    )
  );

  -- service_assignments
  DROP POLICY IF EXISTS service_assignments_member_all ON public.service_assignments;
  CREATE POLICY service_assignments_member_all ON public.service_assignments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid() AND m.status = 'active'
        AND m.role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'owner'::text])
        AND (m.role = ANY (ARRAY['super_admin'::text, 'admin'::text]) OR m.establishment_id = service_assignments.establishment_id)
    )
    OR user_id = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid() AND m.status = 'active'
        AND m.role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'owner'::text])
        AND (m.role = ANY (ARRAY['super_admin'::text, 'admin'::text]) OR m.establishment_id = service_assignments.establishment_id)
    )
  );

  -- cash_register_assignments
  DROP POLICY IF EXISTS cash_register_assignments_member_all ON public.cash_register_assignments;
  CREATE POLICY cash_register_assignments_member_all ON public.cash_register_assignments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid() AND m.status = 'active'
        AND m.role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'owner'::text, 'manager'::text])
        AND (m.role = ANY (ARRAY['super_admin'::text, 'admin'::text]) OR m.establishment_id = cash_register_assignments.establishment_id)
    )
    OR user_id = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid() AND m.status = 'active'
        AND m.role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'owner'::text, 'manager'::text])
        AND (m.role = ANY (ARRAY['super_admin'::text, 'admin'::text]) OR m.establishment_id = cash_register_assignments.establishment_id)
    )
  );

  -- approval_requests
  DROP POLICY IF EXISTS approval_requests_select ON public.approval_requests;
  CREATE POLICY approval_requests_select ON public.approval_requests FOR SELECT TO authenticated
  USING (
    establishment_id IN (
      SELECT m.establishment_id FROM public.members m
      WHERE m.user_id = auth.uid() AND m.status = 'active'
    )
    OR establishment_id IN (
      SELECT me.establishment_id FROM public.member_establishments me
      WHERE me.user_id = auth.uid() AND COALESCE(me.status, 'active') = 'active'
    )
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid() AND m.status = 'active'
        AND m.role = ANY (ARRAY['super_admin'::text, 'admin'::text])
    )
  );

  DROP POLICY IF EXISTS approval_requests_insert ON public.approval_requests;
  CREATE POLICY approval_requests_insert ON public.approval_requests FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND (
      establishment_id IN (
        SELECT m.establishment_id FROM public.members m
        WHERE m.user_id = auth.uid() AND m.status = 'active'
      )
      OR establishment_id IN (
        SELECT me.establishment_id FROM public.member_establishments me
        WHERE me.user_id = auth.uid() AND COALESCE(me.status, 'active') = 'active'
      )
    )
  );

  DROP POLICY IF EXISTS approval_requests_update ON public.approval_requests;
  CREATE POLICY approval_requests_update ON public.approval_requests FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid() AND m.status = 'active'
        AND m.role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'owner'::text, 'manager'::text])
        AND (m.role = ANY (ARRAY['super_admin'::text, 'admin'::text]) OR m.establishment_id = approval_requests.establishment_id)
    )
  )
  WITH CHECK (
    resolved_by IS NULL OR resolved_by <> requested_by
  );
END $$;

COMMENT ON TABLE public.services IS 'GESMAK 3B: services of an establishment';
COMMENT ON TABLE public.cash_registers IS 'GESMAK 3B: cash registers under a service';
COMMENT ON COLUMN public.services.assignment_kind IS 'verified_historical | technical_compat | unknown_needs_reconcile';
