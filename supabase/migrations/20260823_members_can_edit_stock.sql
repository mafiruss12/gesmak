-- Autorisation stock par membre (propriétaire active pour employés)
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS can_edit_stock boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.members.can_edit_stock IS 'Si true, le membre peut modifier inventaire/arrivages même sans rôle owner';
