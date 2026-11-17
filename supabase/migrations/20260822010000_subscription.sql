ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMPTZ;

UPDATE public.establishments
SET trial_ends_at = COALESCE(trial_ends_at, created_at + INTERVAL '30 days'),
    subscription_status = COALESCE(subscription_status, 'trial')
WHERE trial_ends_at IS NULL OR subscription_status IS NULL;
