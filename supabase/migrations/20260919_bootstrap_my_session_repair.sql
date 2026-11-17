-- bootstrap_my_session : répare establishment_id sans créer de faux établissement
-- À coller dans SQL Editor si la fonction n'existe pas ou est incomplète.
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
  est_name text;
  est_type text;
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
    SELECT e.name, e.type INTO est_name, est_type FROM public.establishments e WHERE e.id = est_id;
  END IF;

  RETURN jsonb_build_object(
    'member', to_jsonb(m),
    'establishment', CASE WHEN est_id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', est_id, 'name', COALESCE(est_name, 'Mon établissement'), 'type', COALESCE(est_type, 'maquis')
    ) END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_my_session() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_my_session() TO authenticated;
