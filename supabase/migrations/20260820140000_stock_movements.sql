CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID REFERENCES public.establishments(id) ON DELETE CASCADE,
  product_id UUID,
  product_name TEXT,
  qty NUMERIC NOT NULL,
  movement_type TEXT NOT NULL DEFAULT 'adjustment',
  unit_cost NUMERIC DEFAULT 0,
  unit_price NUMERIC DEFAULT 0,
  reason TEXT,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stock_mov_est_created ON public.stock_movements (establishment_id, created_at DESC);
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stock_movements_select ON public.stock_movements;
CREATE POLICY stock_movements_select ON public.stock_movements FOR SELECT TO authenticated
  USING (
    establishment_id IN (SELECT establishment_id FROM public.members WHERE user_id = auth.uid() AND status = 'active')
    OR establishment_id IN (SELECT establishment_id FROM public.member_establishments WHERE user_id = auth.uid() AND status = 'active')
  );
DROP POLICY IF EXISTS stock_movements_insert ON public.stock_movements;
CREATE POLICY stock_movements_insert ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (
    establishment_id IN (SELECT establishment_id FROM public.members WHERE user_id = auth.uid() AND status = 'active')
    OR establishment_id IN (SELECT establishment_id FROM public.member_establishments WHERE user_id = auth.uid() AND status = 'active')
  );
