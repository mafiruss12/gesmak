-- Increment public stats (callable by anon)
CREATE OR REPLACE FUNCTION public.bump_public_stat(p_est uuid, p_kind text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.public_profile_stats (establishment_id)
  VALUES (p_est)
  ON CONFLICT (establishment_id) DO NOTHING;

  IF p_kind = 'profile' THEN
    UPDATE public.public_profile_stats SET profile_views = profile_views + 1, updated_at = now() WHERE establishment_id = p_est;
  ELSIF p_kind = 'menu' THEN
    UPDATE public.public_profile_stats SET menu_views = menu_views + 1, updated_at = now() WHERE establishment_id = p_est;
  ELSIF p_kind = 'whatsapp' THEN
    UPDATE public.public_profile_stats SET whatsapp_clicks = whatsapp_clicks + 1, updated_at = now() WHERE establishment_id = p_est;
  ELSIF p_kind = 'phone' THEN
    UPDATE public.public_profile_stats SET phone_clicks = phone_clicks + 1, updated_at = now() WHERE establishment_id = p_est;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bump_public_stat(uuid, text) TO anon, authenticated;

DROP POLICY IF EXISTS "auth_insert_own_review" ON public.public_reviews;
CREATE POLICY "auth_insert_own_review" ON public.public_reviews
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "owner_read_stats" ON public.public_profile_stats;
CREATE POLICY "owner_read_stats" ON public.public_profile_stats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid()
        AND (m.role IN ('super_admin','admin') OR m.establishment_id = public_profile_stats.establishment_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.establishments e
      WHERE e.id = public_profile_stats.establishment_id AND e.created_by = auth.uid()
    )
  );
