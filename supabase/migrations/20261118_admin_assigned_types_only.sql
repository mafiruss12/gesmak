-- Restriction stricte : seuls les types d'établissement créés et attribués à la demande par l'administrateur sont autorisés.
ALTER TABLE public.establishments ADD COLUMN IF NOT EXISTS allowed_types text[];
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS allowed_types text[];

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members
    WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
      AND status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- Empêche un non-admin de s'auto-attribuer allowed_types sur members
CREATE OR REPLACE FUNCTION public.protect_member_allowed_types()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_platform_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.allowed_types := NULL;
  ELSIF NEW.allowed_types IS DISTINCT FROM OLD.allowed_types THEN
    RAISE EXCEPTION 'Seul un administrateur peut attribuer des types d''activité.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_member_allowed_types ON public.members;
CREATE TRIGGER trg_protect_member_allowed_types
  BEFORE INSERT OR UPDATE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_member_allowed_types();

-- Empêche un propriétaire de créer un établissement ou de basculer vers un type non attribué par l'administrateur
CREATE OR REPLACE FUNCTION public.enforce_establishment_type_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_allowed text[];
  v_combined text[];
BEGIN
  IF auth.uid() IS NULL OR public.is_platform_admin() THEN
    RETURN NEW;
  END IF;

  SELECT m.allowed_types INTO v_member_allowed
    FROM public.members m
   WHERE m.user_id = auth.uid()
     AND m.status = 'active'
   LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    IF NEW.allowed_types IS NOT NULL AND cardinality(NEW.allowed_types) > 0 THEN
      RAISE EXCEPTION 'Seul un administrateur peut définir les types autorisés.' USING ERRCODE = '42501';
    END IF;
    IF NOT (COALESCE(NEW.type, 'maquis') = ANY(COALESCE(v_member_allowed, ARRAY[]::text[]))) THEN
      RAISE EXCEPTION 'Création refusée : les établissements et types d''activité sont attribués uniquement par l''administrateur sur demande.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.allowed_types IS DISTINCT FROM OLD.allowed_types THEN
    RAISE EXCEPTION 'Seul un administrateur peut modifier les types d''activité autorisés.' USING ERRCODE = '42501';
  END IF;

  IF NEW.type IS DISTINCT FROM OLD.type THEN
    v_combined := COALESCE(OLD.allowed_types, ARRAY[]::text[]) || COALESCE(v_member_allowed, ARRAY[]::text[]);
    IF NOT (COALESCE(NEW.type, 'maquis') = ANY(v_combined)) THEN
      RAISE EXCEPTION 'Changement refusé : ce type d''activité n''a pas été attribué à ce propriétaire par l''administrateur.' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_establishment_type_assignment ON public.establishments;
CREATE TRIGGER trg_enforce_establishment_type_assignment
  BEFORE INSERT OR UPDATE ON public.establishments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_establishment_type_assignment();

-- Mise à jour de bootstrap_my_session() pour exposer allowed_types de l'établissement (member via to_jsonb)
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
        'services', est_rec.services,
        'allowed_types', est_rec.allowed_types
      )
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_my_session() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_my_session() TO authenticated;
