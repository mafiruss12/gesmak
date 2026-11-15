-- Journal d'audit opérations sensibles (Stock Manager AI)
CREATE TABLE IF NOT EXISTS public.operation_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID REFERENCES public.establishments(id) ON DELETE CASCADE,
  actor_id UUID,
  actor_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  entity_label TEXT,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  client_op_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operation_audit_est_created
  ON public.operation_audit (establishment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operation_audit_actor
  ON public.operation_audit (actor_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_operation_audit_client_op
  ON public.operation_audit (client_op_id) WHERE client_op_id IS NOT NULL;

ALTER TABLE public.operation_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS operation_audit_select ON public.operation_audit;
CREATE POLICY operation_audit_select ON public.operation_audit
  FOR SELECT TO authenticated
  USING (
    establishment_id IN (
      SELECT establishment_id FROM public.members
      WHERE user_id = auth.uid() AND status = 'active'
      AND role IN ('owner', 'admin', 'super_admin', 'manager')
    )
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid() AND m.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS operation_audit_insert ON public.operation_audit;
CREATE POLICY operation_audit_insert ON public.operation_audit
  FOR INSERT TO authenticated
  WITH CHECK (
    establishment_id IN (
      SELECT establishment_id FROM public.members
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR establishment_id IN (
      SELECT establishment_id FROM public.member_establishments
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Typologie sorties de caisse (dépenses)
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS kind TEXT DEFAULT 'expense';
-- expense | stock_purchase | charge | other

COMMENT ON TABLE public.operation_audit IS 'Audit: qui / quoi / quand / ancien → nouveau';
