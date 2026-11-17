-- Membership-only access (no permanent created_by leak on UPDATE)
-- + type merge for existing rows

DROP POLICY IF EXISTS update_establishments ON public.establishments;
CREATE POLICY update_establishments ON public.establishments
  FOR UPDATE
  USING (
    is_super_admin()
    OR (id = current_establishment_id())
    OR (id IN (
      SELECT me.establishment_id FROM public.member_establishments me
      WHERE me.user_id = auth.uid() AND COALESCE(me.status, 'active') = 'active'
    ))
  )
  WITH CHECK (
    is_super_admin()
    OR (id = current_establishment_id())
    OR (id IN (
      SELECT me.establishment_id FROM public.member_establishments me
      WHERE me.user_id = auth.uid() AND COALESCE(me.status, 'active') = 'active'
    ))
  );

DROP POLICY IF EXISTS owner_manage_events ON public.public_events;
CREATE POLICY owner_manage_events ON public.public_events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid()
        AND m.status = 'active'
        AND (
          m.role = ANY (ARRAY['super_admin'::text, 'admin'::text])
          OR m.establishment_id = public_events.establishment_id
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.member_establishments me
      WHERE me.user_id = auth.uid()
        AND me.establishment_id = public_events.establishment_id
        AND COALESCE(me.status, 'active') = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid()
        AND m.status = 'active'
        AND (
          m.role = ANY (ARRAY['super_admin'::text, 'admin'::text])
          OR m.establishment_id = public_events.establishment_id
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.member_establishments me
      WHERE me.user_id = auth.uid()
        AND me.establishment_id = public_events.establishment_id
        AND COALESCE(me.status, 'active') = 'active'
    )
  );

UPDATE public.establishments SET type = 'magasin' WHERE type IN ('boutique','superette','quincaillerie','depot','btp');
UPDATE public.establishments SET type = 'complexe' WHERE type IN ('complexe_hotelier');
