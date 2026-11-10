-- P3: garde-fou service ouvert pour commandes QR
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cash_session_id uuid REFERENCES public.cash_sessions(id);

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS cash_session_id uuid REFERENCES public.cash_sessions(id);

CREATE OR REPLACE FUNCTION public.establishment_has_open_session(p_est uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cash_sessions cs
    WHERE cs.establishment_id = p_est
      AND cs.session_date = (timezone('utc', now()))::date
      AND cs.status = 'open'
  );
$$;

COMMENT ON FUNCTION public.establishment_has_open_session IS
  'GESMAK P3: true si une cash_session open existe pour aujourd hui';
