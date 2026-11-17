-- Storage bucket public-vitrine (à créer aussi dans Dashboard Storage si besoin)
INSERT INTO storage.buckets (id, name, public)
VALUES ('public-vitrine', 'public-vitrine', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "public_vitrine_read" ON storage.objects;
CREATE POLICY "public_vitrine_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'public-vitrine');

DROP POLICY IF EXISTS "public_vitrine_upload_auth" ON storage.objects;
CREATE POLICY "public_vitrine_upload_auth" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'public-vitrine');

DROP POLICY IF EXISTS "public_vitrine_update_auth" ON storage.objects;
CREATE POLICY "public_vitrine_update_auth" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'public-vitrine');

ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS is_sponsored boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gallery_urls jsonb DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.service_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  full_name text NOT NULL,
  category text NOT NULL,
  description text,
  phone text,
  city text,
  photo_url text,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.service_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_providers" ON public.service_providers;
CREATE POLICY "anon_select_providers" ON public.service_providers
  FOR SELECT USING (is_published = true);

DROP POLICY IF EXISTS "auth_insert_own_provider" ON public.service_providers;
CREATE POLICY "auth_insert_own_provider" ON public.service_providers
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "auth_update_own_provider" ON public.service_providers;
CREATE POLICY "auth_update_own_provider" ON public.service_providers
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
