-- Phase 2: kits, promotions, menu public, serveur sur tables

-- Établissement: activer menu public
ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS public_menu boolean NOT NULL DEFAULT false;

-- Tables: serveur assigné (membre)
ALTER TABLE public.restaurant_tables
  ADD COLUMN IF NOT EXISTS server_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS server_name text;

-- Kits (bundles de produits)
CREATE TABLE IF NOT EXISTS public.product_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  image_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_kits_est ON public.product_kits(establishment_id);
ALTER TABLE public.product_kits ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.product_kit_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id uuid NOT NULL REFERENCES public.product_kits(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  qty numeric(12,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_kit_items_kit ON public.product_kit_items(kit_id);
ALTER TABLE public.product_kit_items ENABLE ROW LEVEL SECURITY;

-- Promotions
CREATE TABLE IF NOT EXISTS public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  promo_type text NOT NULL DEFAULT 'percent'
    CHECK (promo_type IN ('percent', 'fixed', 'buy_x_get_y', 'kit')),
  value numeric(12,2) NOT NULL DEFAULT 0,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  kit_id uuid REFERENCES public.product_kits(id) ON DELETE SET NULL,
  buy_qty numeric(12,2),
  get_qty numeric(12,2),
  starts_at date,
  ends_at date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_promotions_est ON public.promotions(establishment_id);
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

-- RLS kits
DROP POLICY IF EXISTS "select_kits" ON public.product_kits;
CREATE POLICY "select_kits" ON public.product_kits
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id());

DROP POLICY IF EXISTS "write_kits" ON public.product_kits;
CREATE POLICY "write_kits" ON public.product_kits
  FOR ALL TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id())
  WITH CHECK (public.is_super_admin() OR establishment_id = public.current_establishment_id());

DROP POLICY IF EXISTS "select_kit_items" ON public.product_kit_items;
CREATE POLICY "select_kit_items" ON public.product_kit_items
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.product_kits k
      WHERE k.id = kit_id AND k.establishment_id = public.current_establishment_id()
    )
  );

DROP POLICY IF EXISTS "write_kit_items" ON public.product_kit_items;
CREATE POLICY "write_kit_items" ON public.product_kit_items
  FOR ALL TO authenticated
  USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.product_kits k
      WHERE k.id = kit_id AND k.establishment_id = public.current_establishment_id()
    )
  )
  WITH CHECK (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.product_kits k
      WHERE k.id = kit_id AND k.establishment_id = public.current_establishment_id()
    )
  );

-- RLS promotions
DROP POLICY IF EXISTS "select_promotions" ON public.promotions;
CREATE POLICY "select_promotions" ON public.promotions
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id());

DROP POLICY IF EXISTS "write_promotions" ON public.promotions;
CREATE POLICY "write_promotions" ON public.promotions
  FOR ALL TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id())
  WITH CHECK (public.is_super_admin() OR establishment_id = public.current_establishment_id());

-- Menu public: lecture anonyme si public_menu = true
DROP POLICY IF EXISTS "anon_select_est_public_menu" ON public.establishments;
CREATE POLICY "anon_select_est_public_menu" ON public.establishments
  FOR SELECT TO anon
  USING (public_menu = true);

DROP POLICY IF EXISTS "anon_select_products_public_menu" ON public.products;
CREATE POLICY "anon_select_products_public_menu" ON public.products
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.establishments e
      WHERE e.id = products.establishment_id AND e.public_menu = true
    )
  );

DROP POLICY IF EXISTS "anon_select_kits_public_menu" ON public.product_kits;
CREATE POLICY "anon_select_kits_public_menu" ON public.product_kits
  FOR SELECT TO anon
  USING (
    active = true AND EXISTS (
      SELECT 1 FROM public.establishments e
      WHERE e.id = product_kits.establishment_id AND e.public_menu = true
    )
  );

DROP POLICY IF EXISTS "anon_select_kit_items_public" ON public.product_kit_items;
CREATE POLICY "anon_select_kit_items_public" ON public.product_kit_items
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.product_kits k
      JOIN public.establishments e ON e.id = k.establishment_id
      WHERE k.id = kit_id AND e.public_menu = true AND k.active = true
    )
  );

DROP POLICY IF EXISTS "anon_select_promotions_public" ON public.promotions;
CREATE POLICY "anon_select_promotions_public" ON public.promotions
  FOR SELECT TO anon
  USING (
    active = true AND EXISTS (
      SELECT 1 FROM public.establishments e
      WHERE e.id = promotions.establishment_id AND e.public_menu = true
    )
  );
