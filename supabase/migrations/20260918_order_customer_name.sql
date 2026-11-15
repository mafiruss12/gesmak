ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_name text;

COMMENT ON COLUMN public.orders.customer_name IS 'Nom saisi par le client (commande QR)';
