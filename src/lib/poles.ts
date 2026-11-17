import { supabase } from '@/lib/supabase';
import type { EstablishmentPole, Member, Role } from '@/lib/types';

export interface PolePreset {
  code: string;
  name: string;
  color: string;
  description: string;
}

export const POLE_PRESETS: PolePreset[] = [
  { code: 'maquis', name: 'Maquis', color: '#f59e0b', description: 'Boissons, grillades et terrasse' },
  { code: 'bar', name: 'Bar & Lounge', color: '#ec4899', description: 'Comptoir bar, cocktails et VIP' },
  { code: 'restaurant', name: 'Restaurant', color: '#ef4444', description: 'Salle, cuisine et commandes à table' },
  { code: 'piscine', name: 'Piscine', color: '#06b6d4', description: 'Entrées piscine, transats et boissons bord bassin' },
  { code: 'hotel', name: 'Hôtel & Réception', color: '#6366f1', description: 'Chambres, nuitées et extras clients' },
  { code: 'jeux', name: 'Espace de jeux', color: '#10b981', description: 'Billard, consoles, baby-foot et loisirs' },
  { code: 'boutique', name: 'Boutique / Supérette', color: '#0ea5e9', description: 'Vente au comptoir et articles divers' },
];

export function poleLabel(code: string | null | undefined): string {
  if (!code) return 'Tous pôles / Général';
  const found = POLE_PRESETS.find((p) => p.code === code);
  return found ? found.name : code.charAt(0).toUpperCase() + code.slice(1);
}

export function poleColor(code: string | null | undefined): string {
  if (!code) return '#f59e0b';
  return POLE_PRESETS.find((p) => p.code === code)?.color ?? '#f59e0b';
}

export function isOwnerOrAdmin(role: Role | string | null | undefined): boolean {
  return ['super_admin', 'admin', 'owner', 'proprietaire'].includes(String(role || ''));
}

export function isPoleManager(role: Role | string | null | undefined): boolean {
  return String(role || '') === 'manager';
}

export function isCashierOnly(role: Role | string | null | undefined): boolean {
  return ['cashier', 'employee'].includes(String(role || ''));
}

/**
 * Si le membre est caissière (ou manager affecté à un pôle précis),
 * retourne le code du pôle verrouillé. Pour un propriétaire, retourne null (tous pôles).
 */
export function resolveLockedPole(
  member: Member | null | undefined,
  effectiveRole?: Role | string | null,
): string | null {
  if (!member) return null;
  const r = String(effectiveRole || member.role || '');
  if (isOwnerOrAdmin(r)) return null;
  return member.assigned_pole_code || null;
}

export async function listEstablishmentPoles(estId: string): Promise<EstablishmentPole[]> {
  if (!estId) return [];
  const { data, error } = await supabase
    .from('establishment_poles')
    .select('*')
    .eq('establishment_id', estId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error || !data) return [];
  return data as EstablishmentPole[];
}

export async function ensureDefaultPoles(
  estId: string,
  codes?: string[],
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('ensure_default_poles', {
    p_establishment_id: estId,
    p_codes: codes && codes.length ? codes : null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function setMemberPoleAndPin(params: {
  userId: string;
  establishmentId: string;
  poleCode?: string | null;
  supervisorUserId?: string | null;
  managerPin?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('set_member_pole_and_pin', {
    p_user_id: params.userId,
    p_establishment_id: params.establishmentId,
    p_pole_code: params.poleCode || null,
    p_supervisor_user_id: params.supervisorUserId || null,
    p_manager_pin: params.managerPin?.trim() ? params.managerPin.trim() : null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function verifyManagerPin(params: {
  establishmentId: string;
  poleCode?: string | null;
  pin: string;
  action?: string;
  reason?: string;
}): Promise<{
  ok: boolean;
  approved_by?: string;
  approved_by_name?: string;
  approved_by_role?: string;
  error?: string;
}> {
  const { data, error } = await supabase.rpc('verify_manager_pin', {
    p_establishment_id: params.establishmentId,
    p_pole_code: params.poleCode || null,
    p_pin: params.pin.trim(),
    p_action: params.action || 'pos.approval',
    p_reason: params.reason || null,
  });
  if (error) return { ok: false, error: error.message };
  const res = (data || {}) as {
    ok?: boolean;
    approved_by?: string;
    approved_by_name?: string;
    approved_by_role?: string;
    error?: string;
  };
  return {
    ok: Boolean(res.ok),
    approved_by: res.approved_by,
    approved_by_name: res.approved_by_name,
    approved_by_role: res.approved_by_role,
    error: res.error,
  };
}
