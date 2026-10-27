/**
 * P5 — Contrôle d’accès côté client revalidé depuis la DB (pas seulement le cache local).
 * La source de vérité reste les policies RLS Supabase ; ceci évite l’escalade UI seule.
 */
import { supabase } from '@/lib/supabase';
import { isPrivilegedRole } from '@/lib/security';

export type MemberRole =
  | 'super_admin'
  | 'admin'
  | 'owner'
  | 'proprietaire'
  | 'manager'
  | 'cashier'
  | 'employee'
  | string;

/** Relit le rôle members pour userId (réseau). */
export async function fetchMemberRole(userId: string): Promise<MemberRole | null> {
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from('members')
      .select('role, status')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return null;
    if (data.status && data.status !== 'active') return null;
    return (data.role as MemberRole) || null;
  } catch {
    return null;
  }
}

/** true si super_admin / admin confirmé en base. */
export async function assertPrivilegedUser(userId: string): Promise<{
  ok: boolean;
  role: MemberRole | null;
  reason?: string;
}> {
  const role = await fetchMemberRole(userId);
  if (!role) return { ok: false, role: null, reason: 'Profil introuvable ou inactif' };
  if (!isPrivilegedRole(role)) {
    return { ok: false, role, reason: 'Droits administrateur requis' };
  }
  return { ok: true, role };
}

/** Rôles autorisés à gérer le stock (écriture) — à croiser avec RLS. */
export function canWriteStock(role: MemberRole | null | undefined): boolean {
  return ['super_admin', 'admin', 'owner', 'proprietaire', 'manager'].includes(String(role || ''));
}

export function canManageTeam(role: MemberRole | null | undefined): boolean {
  return ['super_admin', 'admin', 'owner', 'proprietaire'].includes(String(role || ''));
}
