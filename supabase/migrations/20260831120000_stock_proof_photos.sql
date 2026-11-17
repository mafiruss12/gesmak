-- Preuves photo (boissons vendues / stock) consultables et modifiables par le propriétaire
CREATE TABLE IF NOT EXISTS public.stock_proof_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'sale'
    CHECK (kind IN ('sale', 'arrivage', 'stock', 'other')),
  image_url text NOT NULL,
  note text,
  taken_at timestamptz NOT NULL DEFAULT now(),
  taken_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_proof_est ON public.stock_proof_photos(establishment_id);
CREATE INDEX IF NOT EXISTS idx_stock_proof_product ON public.stock_proof_photos(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_proof_taken ON public.stock_proof_photos(taken_at DESC);

ALTER TABLE public.stock_proof_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stock_proof_select ON public.stock_proof_photos;
CREATE POLICY stock_proof_select ON public.stock_proof_photos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid()
        AND m.status = 'active'
        AND (
          m.role IN ('super_admin', 'admin')
          OR m.establishment_id = stock_proof_photos.establishment_id
        )
    )
  );

DROP POLICY IF EXISTS stock_proof_insert ON public.stock_proof_photos;
CREATE POLICY stock_proof_insert ON public.stock_proof_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid()
        AND m.status = 'active'
        AND (
          m.role IN ('super_admin', 'admin')
          OR m.establishment_id = stock_proof_photos.establishment_id
        )
    )
  );

DROP POLICY IF EXISTS stock_proof_update ON public.stock_proof_photos;
CREATE POLICY stock_proof_update ON public.stock_proof_photos
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid()
        AND m.status = 'active'
        AND (
          m.role IN ('super_admin', 'admin', 'owner')
          OR (m.establishment_id = stock_proof_photos.establishment_id AND m.role IN ('owner', 'manager'))
        )
    )
  );

DROP POLICY IF EXISTS stock_proof_delete ON public.stock_proof_photos;
CREATE POLICY stock_proof_delete ON public.stock_proof_photos
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid()
        AND m.status = 'active'
        AND (
          m.role IN ('super_admin', 'admin', 'owner')
          OR (m.establishment_id = stock_proof_photos.establishment_id AND m.role = 'owner')
        )
    )
  );

-- Bucket storage (exécuter aussi dans Dashboard Storage si besoin)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'stock-proofs',
  'stock-proofs',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS stock_proofs_storage_select ON storage.objects;
CREATE POLICY stock_proofs_storage_select ON storage.objects
  FOR SELECT TO authenticated, anon
  USING (bucket_id = 'stock-proofs');

DROP POLICY IF EXISTS stock_proofs_storage_insert ON storage.objects;
CREATE POLICY stock_proofs_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'stock-proofs');

DROP POLICY IF EXISTS stock_proofs_storage_update ON storage.objects;
CREATE POLICY stock_proofs_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'stock-proofs');

DROP POLICY IF EXISTS stock_proofs_storage_delete ON storage.objects;
CREATE POLICY stock_proofs_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'stock-proofs');
