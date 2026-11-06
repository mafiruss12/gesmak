/**
 * Callback OAuth (Google) — flux PKCE
 * URL typique : /auth/callback?code=...
 * Un seul exchangeCodeForSession par code.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { GesmakLoading } from '@/components/GesmakLoading';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('Connexion Google en cours…');
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    let cancelled = false;

    (async () => {
      try {
        const href = window.location.href;
        const url = new URL(href);
        const code = url.searchParams.get('code');
        const err =
          url.searchParams.get('error_description') ||
          url.searchParams.get('error') ||
          new URLSearchParams(url.hash.replace(/^#/, '')).get('error_description') ||
          new URLSearchParams(url.hash.replace(/^#/, '')).get('error');

        if (err) {
          const decoded = decodeURIComponent(String(err).replace(/\+/g, ' '));
          if (!cancelled) {
            setError(
              /access_denied/i.test(decoded)
                ? 'Connexion Google annulée.'
                : `Connexion Google impossible : ${decoded}`,
            );
          }
          return;
        }

        // PKCE : échanger le code une seule fois
        if (code) {
          setMessage('Validation de la session…');
          const { data, error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exErr) {
            // Code déjà consommé ou expiré : tenter getSession
            const { data: s } = await supabase.auth.getSession();
            if (!s.session) {
              if (!cancelled) {
                setError(
                  /code/i.test(exErr.message)
                    ? 'Session Google expirée ou déjà utilisée. Réessayez « Continuer avec Google ».'
                    : exErr.message || 'Connexion Google impossible. Réessayez.',
                );
              }
              return;
            }
          } else if (!data.session) {
            if (!cancelled) setError('Aucune session après Google. Réessayez.');
            return;
          }
        } else {
          // Implicit fallback (hash tokens) — detectSessionInUrl peut déjà avoir posé la session
          setMessage('Récupération de la session…');
          // petits retries
          let session = (await supabase.auth.getSession()).data.session;
          for (let i = 0; i < 5 && !session; i++) {
            await new Promise((r) => setTimeout(r, 200));
            session = (await supabase.auth.getSession()).data.session;
          }
          if (!session) {
            // hash access_token ?
            const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
            if (hash.get('access_token')) {
              // laisser detectSessionInUrl / client parser
              await new Promise((r) => setTimeout(r, 400));
              session = (await supabase.auth.getSession()).data.session;
            }
          }
          if (!session) {
            if (!cancelled) {
              setError('Connexion Google incomplète. Réessayez depuis la page de connexion.');
            }
            return;
          }
        }

        // Nettoyer l’URL (code à usage unique)
        window.history.replaceState({}, '', '/auth/callback');

        if (!cancelled) setMessage('Connexion réussie…');
        // AuthProvider (SIGNED_IN) charge le membre ; on envoie au dashboard
        navigate('/dashboard', { replace: true });
      } catch (e: unknown) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : 'Connexion Google impossible. Vérifiez Internet et réessayez.',
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (!error) {
    return <GesmakLoading variant="full" label={message || 'Finalisation de la connexion…'} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 auth-gesmak-shell"
      style={{ background: 'linear-gradient(165deg, #f8fafc 0%, #eef2ff 40%, #fff7ed 100%)' }}>
      <div className="max-w-sm w-full rounded-2xl bg-white border border-stone-200 shadow-lg p-6 text-center space-y-4">
        <img src="/logo-circle.png" alt="GESMAK" className="w-14 h-14 rounded-full mx-auto object-cover" />
        <p className="text-sm text-red-600">{error}</p>
        <button
          type="button"
          className="btn-primary w-full"
          onClick={() => navigate('/login', { replace: true })}
        >
          Retour à la connexion
        </button>
      </div>
    </div>
  );
}
