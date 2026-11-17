import { useAuth } from './auth';

/**
 * ID établissement actif.
 * Ordre : sélecteur actif → membre → cache localStorage (évite liste vide
 * juste après F5 tant que member n'est pas encore hydraté).
 */
export function useEstId(): string | null {
  const { member, activeEstablishment, user } = useAuth();
  if (activeEstablishment?.id) return activeEstablishment.id;
  if (member?.establishment_id) return member.establishment_id;
  try {
    const uid = user?.id || member?.user_id;
    const raw =
      (uid && localStorage.getItem(`mm_active_est:${uid}`)) ||
      localStorage.getItem('mm_active_est');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.id) return String(parsed.id);
  } catch {
    /* */
  }
  return null;
}
