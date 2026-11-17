-- Position GPS des établissements (assistance admin)
ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;

COMMENT ON COLUMN public.establishments.latitude IS 'Latitude GPS (consentement propriétaire)';
COMMENT ON COLUMN public.establishments.longitude IS 'Longitude GPS (consentement propriétaire)';
COMMENT ON COLUMN public.establishments.location_updated_at IS 'Dernière mise à jour de la position GPS';
