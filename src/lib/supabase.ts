import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseUrl.startsWith('http') &&
    !supabaseUrl.includes('placeholder') &&
    supabaseAnonKey &&
    supabaseAnonKey.length > 40 &&
    !supabaseAnonKey.includes('placeholder')
);

if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY manquant. Vérifie ton .env local.'
  );
}

export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON = supabaseAnonKey;

/** Clé stable = même projet, évite les collisions entre environnements */
const AUTH_STORAGE_KEY = 'sb-ycoaxbgxstxondxxnhhf-auth-token';

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Pas d'OAuth Google : éviter qu'un ?code= résiduel invalide la session au refresh
      detectSessionInUrl: false,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      storageKey: AUTH_STORAGE_KEY,
      // implicit = plus fiable pour login email/password SPA (évite courses PKCE au reload)
      flowType: 'implicit',
    },
  }
);
