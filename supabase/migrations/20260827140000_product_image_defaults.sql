-- Catalogue d'images par défaut (source AU GBAISSAI CHEZ RCO) pour tous les maquis
CREATE TABLE IF NOT EXISTS public.product_image_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_key text NOT NULL UNIQUE,
  name text NOT NULL,
  image_url text NOT NULL,
  source_establishment_id uuid,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.product_image_defaults ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS product_image_defaults_select ON public.product_image_defaults;
CREATE POLICY product_image_defaults_select ON public.product_image_defaults
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS product_image_defaults_admin ON public.product_image_defaults;
CREATE POLICY product_image_defaults_admin ON public.product_image_defaults
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.user_id = auth.uid()
        AND m.role IN ('super_admin', 'admin')
        AND m.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.user_id = auth.uid()
        AND m.role IN ('super_admin', 'admin')
        AND m.status = 'active'
    )
  );
