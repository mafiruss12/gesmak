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

/** Fetch sécurisé qui vérifie si la réponse est bien du JSON (évite les erreurs de parsing sur les pages HTML 404 / SPA) */
export async function safeJsonFetch(input: RequestInfo, init?: RequestInit): Promise<any> {
  const res = await fetch(input, init);
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text().catch(() => '');
    if (text.includes('<!doctype html>') || text.includes('<html')) {
      throw new Error(`Route API introuvable (${res.status}) ou serveur statique (HTML reçu au lieu de JSON).`);
    }
    throw new Error(`Erreur serveur (${res.status}): Réponse non-JSON reçue.`);
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || `Erreur HTTP ${res.status}`);
  }
  return data;
}

