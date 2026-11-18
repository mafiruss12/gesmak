-- 1) S'assurer que proof_note existe sur payment_requests et services sur establishments
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS proof_note text;
ALTER TABLE public.establishments ADD COLUMN IF NOT EXISTS services text[];

-- 2) bootstrap_my_session complet : inclut les champs d'abonnement, plan_tier, created_at, logo_url et services
CREATE OR REPLACE FUNCTION public.bootstrap_my_session()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  m public.members%ROWTYPE;
  est_id uuid;
  est_rec RECORD;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT * INTO m FROM public.members WHERE user_id = uid LIMIT 1;

  IF m.user_id IS NULL THEN
    RETURN jsonb_build_object('member', null, 'establishment', null);
  END IF;

  est_id := m.establishment_id;

  IF est_id IS NULL THEN
    SELECT e.id INTO est_id FROM public.establishments e
      WHERE e.created_by = uid ORDER BY e.created_at ASC LIMIT 1;
  END IF;

  IF est_id IS NULL THEN
    BEGIN
      SELECT e.id INTO est_id FROM public.establishments e
        WHERE e.owner_user_id = uid ORDER BY e.created_at ASC LIMIT 1;
    EXCEPTION WHEN undefined_column THEN
      NULL;
    END;
  END IF;

  IF est_id IS NULL THEN
    SELECT me.establishment_id INTO est_id
      FROM public.member_establishments me
      WHERE me.user_id = uid AND me.status = 'active'
      ORDER BY me.created_at ASC NULLS LAST
      LIMIT 1;
  END IF;

  IF est_id IS NOT NULL AND (m.establishment_id IS NULL OR m.establishment_id IS DISTINCT FROM est_id) THEN
    UPDATE public.members SET establishment_id = est_id WHERE user_id = uid;
    m.establishment_id := est_id;
  END IF;

  IF est_id IS NOT NULL THEN
    INSERT INTO public.member_establishments (user_id, establishment_id, role, status)
    VALUES (uid, est_id, COALESCE(m.role, 'owner'), 'active')
    ON CONFLICT DO NOTHING;
  END IF;

  IF est_id IS NOT NULL THEN
    SELECT e.* INTO est_rec FROM public.establishments e WHERE e.id = est_id;
  END IF;

  RETURN jsonb_build_object(
    'member', to_jsonb(m),
    'establishment', CASE
      WHEN est_id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', est_id,
        'name', COALESCE(est_rec.name, 'Mon établissement'),
        'type', COALESCE(est_rec.type, 'maquis'),
        'subscription_status', est_rec.subscription_status,
        'trial_ends_at', est_rec.trial_ends_at,
        'subscription_ends_at', est_rec.subscription_ends_at,
        'last_payment_at', est_rec.last_payment_at,
        'plan_tier', est_rec.plan_tier,
        'created_at', est_rec.created_at,
        'logo_url', est_rec.logo_url,
        'services', est_rec.services
      )
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_my_session() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_my_session() TO authenticated;

-- 3) Helper serveur de vérification d'abonnement actif (incluant période de grâce 3 jours)
CREATE OR REPLACE FUNCTION public.is_establishment_subscription_active(p_est uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e RECORD;
  v_status text;
  v_end timestamptz;
BEGIN
  IF p_est IS NULL THEN
    RETURN false;
  END IF;

  SELECT subscription_status, trial_ends_at, subscription_ends_at, created_at
    INTO e
    FROM public.establishments
   WHERE id = p_est;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  v_status := COALESCE(NULLIF(LOWER(TRIM(e.subscription_status)), ''), 'trial');

  IF v_status = 'suspended' THEN
    RETURN false;
  END IF;

  IF v_status = 'active' THEN
    IF e.subscription_ends_at IS NULL THEN
      RETURN true;
    END IF;
    RETURN now() <= (e.subscription_ends_at + interval '3 days');
  END IF;

  IF v_status = 'past_due' THEN
    v_end := COALESCE(e.subscription_ends_at, e.trial_ends_at, e.created_at + interval '30 days');
    RETURN now() <= (v_end + interval '3 days');
  END IF;

  -- trial
  v_end := COALESCE(e.trial_ends_at, e.created_at + interval '30 days');
  RETURN now() <= (v_end + interval '3 days');
END;
$$;

REVOKE ALL ON FUNCTION public.is_establishment_subscription_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_establishment_subscription_active(uuid) TO authenticated;
