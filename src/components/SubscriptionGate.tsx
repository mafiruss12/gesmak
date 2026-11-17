import { Link, Navigate, useLocation } from 'react-router-dom';
import { AlertTriangle, MessageCircle, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  getSubscriptionState,
  PLAN,
  paymentInstructions,
  paymentWhatsAppLink,
} from '@/lib/subscription';

/** Routes autorisées uniquement si réellement bloqué (impayé / essai terminé). */
const ALLOWED_WHEN_BLOCKED = ['/subscription', '/settings'];

export default function SubscriptionGate() {
  const { activeEstablishment, effectiveRole, member, signOut } = useAuth();
  const location = useLocation();
  const role = String(effectiveRole || member?.role || '');
  const isPlatformAdmin = ['super_admin', 'admin'].includes(role);

  if (isPlatformAdmin) return null;
  if (!activeEstablishment) return null;

  const state = getSubscriptionState(
    activeEstablishment as Parameters<typeof getSubscriptionState>[0]
  );

  // Abonnement actif ou essai en cours : pas de redirection forcée
  if (!state.blocked) {
    if (!state.message) return null;
    // Simple rappel (essai bientôt fini / past_due soft) — pas un verrou
    return (
      <div className="mx-3 mt-2 sm:mx-4 rounded-xl px-3 py-2.5 text-xs sm:text-sm border border-amber-500/40 bg-amber-50 text-amber-950 dark:bg-amber-500/15 dark:text-amber-50 flex flex-wrap items-center gap-2">
        <span className="flex-1">
          <span className="font-semibold">{state.label}</span>
          {' · '}
          {state.message}
        </span>
        {(state.status === 'past_due' || (state.daysLeft != null && state.daysLeft <= 7)) && (
          <Link
            to="/subscription"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-600 text-white text-xs font-semibold"
          >
            Forfaits
          </Link>
        )}
      </div>
    );
  }

  const pathOk = ALLOWED_WHEN_BLOCKED.some(
    (p) => location.pathname === p || location.pathname.startsWith(p + '/')
  );
  const estName = activeEstablishment?.name || '';
  const wa = paymentWhatsAppLink(
    `Bonjour, je souhaite régulariser l'abonnement GESMAK.\nÉtablissement : ${estName}\nOffre : ${PLAN.monthlyFcfa} F/mois.`
  );

  if (!pathOk) {
    return <Navigate to="/subscription" replace state={{ reason: 'subscription_blocked' }} />;
  }

  return (
    <div className="mx-3 mt-2 sm:mx-4 rounded-2xl border border-red-600/50 bg-red-50 text-red-950 dark:bg-red-950/90 dark:text-red-50 px-4 py-3.5 text-sm space-y-2 shadow-sm">
      <div className="flex items-start gap-2">
        <AlertTriangle size={18} className="shrink-0 mt-0.5 text-red-600 dark:text-red-300" />
        <div className="flex-1 space-y-1">
          <p className="font-semibold text-base">Abonnement requis</p>
          <p className="text-sm opacity-90 leading-snug">
            {state.message ||
              `Essai ou forfait terminé. Payez ${PLAN.monthlyFcfa.toLocaleString('fr-FR')} F/mois pour réactiver l'app.`}
          </p>
          <p className="text-[11px] opacity-70 whitespace-pre-wrap font-mono leading-relaxed">
            {paymentInstructions()}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <Link
          to="/subscription"
          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-sky-600 text-white text-xs font-semibold"
        >
          Forfaits / Payer
        </Link>
        <a
          href={wa}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
        >
          <MessageCircle size={14} /> WhatsApp
        </a>
        <button
          type="button"
          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-red-300/60 dark:border-red-400/40 text-xs font-medium"
          onClick={async () => {
            try {
              await signOut();
            } catch {
              /* */
            }
            window.location.assign('/');
          }}
        >
          <LogOut size={14} /> Déconnexion
        </button>
      </div>
    </div>
  );
}
