/*
# Fonctions helper et politiques RLS

## Description
- Crée deux fonctions SECURITY DEFINER pour vérifier le rôle et l'établissement
- Applique les politiques RLS sur establishments, members, products

## Fonctions
1. is_super_admin() — Vérifie si l'utilisateur courant est super_admin actif
2. current_establishment_id() — Retourne l'établissement de l'utilisateur courant

## Sécurité
- Le super admin a accès à tout
- Les autres membres ne voient que les données de leur établissement
- Les membres peuvent lire leur propre profil et s'inscrire eux-mêmes
*/

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
    AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_establishment_id()
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT establishment_id FROM public.members
  WHERE user_id = auth.uid() AND status = 'active';
$$;

-- ============ ESTABLISHMENTS ============
DROP POLICY IF EXISTS "select_establishments" ON public.establishments;
CREATE POLICY "select_establishments" ON public.establishments
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR id = public.current_establishment_id());

DROP POLICY IF EXISTS "insert_establishments" ON public.establishments;
CREATE POLICY "insert_establishments" ON public.establishments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "update_establishments" ON public.establishments;
CREATE POLICY "update_establishments" ON public.establishments
  FOR UPDATE TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "delete_establishments" ON public.establishments;
CREATE POLICY "delete_establishments" ON public.establishments
  FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- ============ MEMBERS ============
DROP POLICY IF EXISTS "select_members" ON public.members;
CREATE POLICY "select_members" ON public.members
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS "insert_members" ON public.members;
CREATE POLICY "insert_members" ON public.members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS "update_members" ON public.members;
CREATE POLICY "update_members" ON public.members
  FOR UPDATE TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "delete_members" ON public.members;
CREATE POLICY "delete_members" ON public.members
  FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- ============ PRODUCTS ============
DROP POLICY IF EXISTS "select_products" ON public.products;
CREATE POLICY "select_products" ON public.products
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id());

DROP POLICY IF EXISTS "insert_products" ON public.products;
CREATE POLICY "insert_products" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR establishment_id = public.current_establishment_id());

DROP POLICY IF EXISTS "update_products" ON public.products;
CREATE POLICY "update_products" ON public.products
  FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id())
  WITH CHECK (public.is_super_admin() OR establishment_id = public.current_establishment_id());

DROP POLICY IF EXISTS "delete_products" ON public.products;
CREATE POLICY "delete_products" ON public.products
  FOR DELETE TO authenticated
  USING (public.is_super_admin() OR establishment_id = public.current_establishment_id());
