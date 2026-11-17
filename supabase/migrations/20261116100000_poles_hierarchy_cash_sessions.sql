-- Chantier 1 : Hiérarchie stricte (Propriétaire -> Manager de pôle -> Caissière)
-- & Complexe multi-pôles / multi-caisses reliées au même établissement

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Table des pôles / caisses d'un établissement (Maquis, Bar, Resto, Piscine, Hôtel, Jeux…)
CREATE TABLE IF NOT EXISTS public.establishment_poles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  color text DEFAULT '#f59e0b',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (establishment_id, code)
);

CREATE INDEX IF NOT EXISTS idx_establishment_poles_est
  ON public.establishment_poles(establishment_id, is_active, sort_order);

ALTER TABLE public.establishment_poles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "poles_select_member" ON public.establishment_poles;
CREATE POLICY "poles_select_member" ON public.establishment_poles
  FOR SELECT USING (public.is_member_of(establishment_id));

DROP POLICY IF EXISTS "poles_write_owner" ON public.establishment_poles;
CREATE POLICY "poles_write_owner" ON public.establishment_poles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid()
        AND m.establishment_id = establishment_poles.establishment_id
        AND m.status = 'active'
        AND m.role IN ('super_admin', 'admin', 'owner')
    )
    OR public.is_super_admin()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid()
        AND m.establishment_id = establishment_poles.establishment_id
        AND m.status = 'active'
        AND m.role IN ('super_admin', 'admin', 'owner')
    )
    OR public.is_super_admin()
  );

-- 2. Colonnes sur members & member_establishments : affectation pôle, superviseur, PIN manager
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS assigned_pole_code text,
  ADD COLUMN IF NOT EXISTS supervisor_user_id uuid,
  ADD COLUMN IF NOT EXISTS manager_pin_hash text;

ALTER TABLE public.member_establishments
  ADD COLUMN IF NOT EXISTS assigned_pole_code text,
  ADD COLUMN IF NOT EXISTS supervisor_user_id uuid;

-- 3. Colonnes pole_code sur les flux caisse / ventes / commandes / sessions / dépenses
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS pole_code text,
  ADD COLUMN IF NOT EXISTS cash_session_id uuid;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pole_code text;

ALTER TABLE public.cash_sessions
  ADD COLUMN IF NOT EXISTS pole_code text,
  ADD COLUMN IF NOT EXISTS cashier_name text,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_by_name text;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS pole_code text;

CREATE INDEX IF NOT EXISTS idx_sales_est_pole_created
  ON public.sales(establishment_id, pole_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_est_pole_date
  ON public.cash_sessions(establishment_id, pole_code, session_date DESC);

-- 4. RPC : initialiser / activer les pôles d'un établissement
CREATE OR REPLACE FUNCTION public.ensure_default_poles(
  p_establishment_id uuid,
  p_codes text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  actor_uid uuid := auth.uid();
  actor_role text;
  v_code text;
  v_idx int := 0;
  v_codes text[] := COALESCE(
    p_codes,
    ARRAY['maquis', 'bar', 'restaurant', 'piscine', 'hotel', 'jeux']
  );
  v_name text;
  v_color text;
BEGIN
  IF actor_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  SELECT role INTO actor_role
  FROM public.members
  WHERE user_id = actor_uid AND status = 'active'
  LIMIT 1;

  IF actor_role NOT IN ('super_admin', 'admin', 'owner', 'manager') THEN
    RAISE EXCEPTION 'Droit insuffisant';
  END IF;

  FOREACH v_code IN ARRAY v_codes LOOP
    v_idx := v_idx + 1;
    v_name := CASE v_code
      WHEN 'maquis' THEN 'Maquis'
      WHEN 'bar' THEN 'Bar & Lounge'
      WHEN 'restaurant' THEN 'Restaurant'
      WHEN 'piscine' THEN 'Piscine'
      WHEN 'hotel' THEN 'Hôtel & Réception'
      WHEN 'jeux' THEN 'Espace de jeux'
      WHEN 'boutique' THEN 'Boutique / Supérette'
      ELSE initcap(v_code)
    END;
    v_color := CASE v_code
      WHEN 'maquis' THEN '#f59e0b'
      WHEN 'bar' THEN '#ec4899'
      WHEN 'restaurant' THEN '#ef4444'
      WHEN 'piscine' THEN '#06b6d4'
      WHEN 'hotel' THEN '#6366f1'
      WHEN 'jeux' THEN '#10b981'
      WHEN 'boutique' THEN '#0ea5e9'
      ELSE '#f59e0b'
    END;

    INSERT INTO public.establishment_poles (establishment_id, code, name, color, is_active, sort_order)
    VALUES (p_establishment_id, v_code, v_name, v_color, true, v_idx)
    ON CONFLICT (establishment_id, code) DO UPDATE SET
      is_active = true,
      sort_order = EXCLUDED.sort_order;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'count', v_idx);
END;
$$;

-- 5. RPC : affecter un pôle, un superviseur et/ou un code PIN Manager en respectant la hiérarchie
CREATE OR REPLACE FUNCTION public.set_member_pole_and_pin(
  p_user_id uuid,
  p_establishment_id uuid,
  p_pole_code text DEFAULT NULL,
  p_supervisor_user_id uuid DEFAULT NULL,
  p_manager_pin text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  actor_uid uuid := auth.uid();
  actor_role text;
  actor_est uuid;
  actor_pole text;
  target_role text;
  v_pin_hash text;
  v_clean_pole text := NULLIF(trim(COALESCE(p_pole_code, '')), '');
BEGIN
  IF actor_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  SELECT role, establishment_id, assigned_pole_code
  INTO actor_role, actor_est, actor_pole
  FROM public.members
  WHERE user_id = actor_uid AND status = 'active'
  LIMIT 1;

  IF actor_role IS NULL OR actor_role NOT IN ('super_admin', 'admin', 'owner', 'manager') THEN
    RAISE EXCEPTION 'Droit insuffisant';
  END IF;

  IF actor_role NOT IN ('super_admin', 'admin') AND actor_est <> p_establishment_id THEN
    RAISE EXCEPTION 'Établissement non autorisé';
  END IF;

  SELECT role INTO target_role
  FROM public.members
  WHERE user_id = p_user_id
  LIMIT 1;

  IF actor_role = 'manager' THEN
    -- Un manager ne peut gérer que des caissières/employés et uniquement dans son pôle
    IF COALESCE(target_role, 'cashier') NOT IN ('cashier', 'employee') AND p_user_id <> actor_uid THEN
      RAISE EXCEPTION 'Un manager ne peut configurer que ses caissières';
    END IF;
    IF actor_pole IS NOT NULL AND v_clean_pole IS NOT NULL AND v_clean_pole <> actor_pole THEN
      RAISE EXCEPTION 'Un manager ne peut affecter que son propre pôle (%)', actor_pole;
    END IF;
    IF v_clean_pole IS NULL AND actor_pole IS NOT NULL THEN
      v_clean_pole := actor_pole;
    END IF;
  END IF;

  IF p_manager_pin IS NOT NULL AND length(trim(p_manager_pin)) >= 4 THEN
    v_pin_hash := encode(extensions.digest(trim(p_manager_pin), 'sha256'), 'hex');
  ELSE
    v_pin_hash := NULL;
  END IF;

  UPDATE public.members
  SET
    assigned_pole_code = v_clean_pole,
    supervisor_user_id = COALESCE(p_supervisor_user_id, supervisor_user_id),
    manager_pin_hash = COALESCE(v_pin_hash, manager_pin_hash)
  WHERE user_id = p_user_id;

  INSERT INTO public.member_establishments (
    user_id, establishment_id, role, status, assigned_pole_code, supervisor_user_id
  )
  VALUES (
    p_user_id,
    p_establishment_id,
    COALESCE(target_role, 'cashier'),
    'active',
    v_clean_pole,
    p_supervisor_user_id
  )
  ON CONFLICT (user_id, establishment_id) DO UPDATE SET
    assigned_pole_code = EXCLUDED.assigned_pole_code,
    supervisor_user_id = COALESCE(EXCLUDED.supervisor_user_id, member_establishments.supervisor_user_id);

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', p_user_id,
    'pole_code', v_clean_pole,
    'pin_set', v_pin_hash IS NOT NULL
  );
END;
$$;

-- 6. RPC : vérifier le code PIN d'un manager du pôle (ou propriétaire) pour validation terrain
CREATE OR REPLACE FUNCTION public.verify_manager_pin(
  p_establishment_id uuid,
  p_pole_code text,
  p_pin text,
  p_action text DEFAULT 'pos.approval',
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  actor_uid uuid := auth.uid();
  actor_name text;
  v_hash text;
  v_mgr record;
BEGIN
  IF actor_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  IF p_pin IS NULL OR length(trim(p_pin)) < 4 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Code PIN invalide');
  END IF;

  v_hash := encode(extensions.digest(trim(p_pin), 'sha256'), 'hex');

  SELECT COALESCE(full_name, email) INTO actor_name
  FROM public.members WHERE user_id = actor_uid LIMIT 1;

  SELECT m.user_id, m.full_name, m.email, m.role, m.assigned_pole_code
  INTO v_mgr
  FROM public.members m
  WHERE m.establishment_id = p_establishment_id
    AND m.status = 'active'
    AND m.role IN ('owner', 'manager', 'admin', 'super_admin')
    AND m.manager_pin_hash = v_hash
    AND (
      m.role IN ('owner', 'admin', 'super_admin')
      OR m.assigned_pole_code IS NULL
      OR p_pole_code IS NULL
      OR m.assigned_pole_code = p_pole_code
    )
  ORDER BY CASE WHEN m.role = 'manager' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_mgr.user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PIN manager incorrect pour ce pôle');
  END IF;

  INSERT INTO public.operation_audit (
    establishment_id, actor_id, actor_name, action, entity_type, entity_label, new_value, reason
  ) VALUES (
    p_establishment_id,
    actor_uid,
    COALESCE(actor_name, 'Caissière'),
    COALESCE(p_action, 'pos.approval'),
    'pole_pin',
    COALESCE(p_pole_code, 'general'),
    jsonb_build_object(
      'approved_by', v_mgr.user_id,
      'approved_by_name', COALESCE(v_mgr.full_name, v_mgr.email),
      'approved_by_role', v_mgr.role
    ),
    COALESCE(p_reason, 'Validation manager par PIN')
  );

  RETURN jsonb_build_object(
    'ok', true,
    'approved_by', v_mgr.user_id,
    'approved_by_name', COALESCE(v_mgr.full_name, v_mgr.email),
    'approved_by_role', v_mgr.role
  );
END;
$$;
