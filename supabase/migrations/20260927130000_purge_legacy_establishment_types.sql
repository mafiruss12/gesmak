-- Ne garder que maquis | location_event | complexe
UPDATE public.establishments
SET type = 'complexe'
WHERE type IS DISTINCT FROM 'maquis'
  AND type IS DISTINCT FROM 'location_event'
  AND type IS DISTINCT FROM 'complexe';
