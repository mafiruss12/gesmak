import type { PostgrestError } from '@supabase/supabase-js';

export function apiErrorMessage(error: PostgrestError | Error | null | undefined, fallback = 'Erreur réseau'): string {
  if (!error) return fallback;
  const msg = 'message' in error ? error.message : String(error);
  if (/JWT|session|token/i.test(msg)) return 'Session expirée. Reconnectez-vous.';
  if (/permission|policy|RLS|row-level/i.test(msg)) return 'Action non autorisée.';
  if (/network|fetch|Failed to fetch/i.test(msg)) return 'Connexion internet indisponible.';
  return msg || fallback;
}

/** Vérifie le résultat d'une requête Supabase et renvoie data ou throw message clair */
export function unwrap<T>(
  result: { data: T; error: PostgrestError | null },
  fallbackMsg = 'Impossible de charger les données'
): T {
  if (result.error) {
    throw new Error(apiErrorMessage(result.error, fallbackMsg));
  }
  return result.data;
}
