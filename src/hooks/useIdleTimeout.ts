import { useEffect, useRef } from 'react';

const DEFAULT_MS = 15 * 60 * 1000; // 15 minutes
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'] as const;

/**
 * Déconnexion après inactivité (par défaut 15 min).
 * Réinitialise le délai à chaque interaction utilisateur.
 */
export function useIdleTimeout(onIdle: () => void, enabled = true, timeoutMs = DEFAULT_MS) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    if (!enabled) return;

    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        onIdleRef.current();
      }, timeoutMs);
    };

    reset();
    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, reset, { passive: true });
    }

    return () => {
      if (timer.current) clearTimeout(timer.current);
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, reset);
      }
    };
  }, [enabled, timeoutMs]);
}
