-- Public discovery platform
ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS opening_hours jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS public_show_stock boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS public_rating numeric(3,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS public_reviews_count int DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS establishments_slug_uidx ON public.establishments (slug) WHERE slug IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.public_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid REFERENCES public.establishments(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  image_url text,
  venue text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  price_label text,
  artist text,
  is_published boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.public_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_published_events" ON public.public_events;
CREATE POLICY "anon_select_published_events" ON public.public_events FOR SELECT USING (is_published = true);

CREATE TABLE IF NOT EXISTS public.public_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  user_id uuid,
  author_name text,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.public_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_visible_reviews" ON public.public_reviews;
CREATE POLICY "anon_select_visible_reviews" ON public.public_reviews FOR SELECT USING (is_visible = true);

CREATE TABLE IF NOT EXISTS public.public_profile_stats (
  establishment_id uuid PRIMARY KEY REFERENCES public.establishments(id) ON DELETE CASCADE,
  profile_views int NOT NULL DEFAULT 0,
  menu_views int NOT NULL DEFAULT 0,
  whatsapp_clicks int NOT NULL DEFAULT 0,
  phone_clicks int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.public_profile_stats ENABLE ROW LEVEL SECURITY;
