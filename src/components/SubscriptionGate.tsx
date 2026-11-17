import { Link, Navigate, useLocation } from 'react-router-dom';
import { AlertTriangle, MessageCircle, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  getSubscriptionState,
  PLAN,
  paymentInstructions,
  paymentWhatsAppLink,
} from '@/lib/subscription';

/** Seules ces routes restent accessibles quand l'abonnement est bloqué. */
const ALLOWED_WHEN_BLOCKED = ['/subscription', '/settings'];

export default function SubscriptionGate() {
  const { activeEstablishment, effectiveRole, member, signOut } = useAuth();
  const location = useLocation();
  const role = String(effectiveRole || member?.role || '');
  const isPlatformAdmin = ['super_admin', 'admin'].includes(role);

  const state = getSubscriptionState(
    activeEstablishment as Parameters<typeof getSubscriptionState>[0]
  );
  const estName = activeEstablishment?.name || '';

  if (isPlatformAdmin) return null;
  if (!activeEstablishment) return null;

  const pathOk = ALLOWED_WHEN_BLOCKED.some(
    (p) => location.pathname === p || location.pathname.startsWith(p + '/')
  );
  const wa = paymentWhatsAppLink(
    `Bonjour, je souhaite régulariser l'abonnement GESMAK.\nÉtablissement : ${estName}\nOffre : ${PLAN.monthlyFcfa} F/mois (1, 3, 6, 12 mois ou plus).`
  );

  // Essai bientôt fini / grâce past_due
  if (!state.blocked) {
    if (!state.message) return null;
    return (
      <div
        className={`mx-3 mt-2 sm:mx-4 rounded-xl px-3 py-2 text-xs sm:text-sm border flex flex-wrap items-center gap-2 ${
          state.status === 'past_due'
            ? 'border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-100'
            : 'border-stone-200 bg-white text-stone-800 dark:border-stone-700 dark:bg-stone-900/80 dark:text-stone-300'
        }`}
      >
        <span className="flex-1">
          <span className="font-medium">{state.label}</span>
          {' · '}
          {state.message}
        </span>
        {(state.status === 'past_due' || (state.daysLeft != null && state.daysLeft <= 7)) && (
          <>
            <Link
              to="/subscription"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-600 text-white text-xs font-medium"
            >
              Payer / Forfaits
            </Link>
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 text-white text-xs font-medium"
            >
              <MessageCircle size={14} /> WhatsApp
            </a>
          </>
        )}
      </div>
    );
  }

  // BLOQUÉ : hors /subscription|/settings → redirection stricte
  if (!pathOk) {
    return <Navigate to="/subscription" replace state={{ reason: 'subscription_blocked' }} />;
  }

  // Sur pages autorisées : bannière collante (sans masquer le formulaire de paiement)
  return (
    <div className="mx-3 mt-2 sm:mx-4 rounded-xl border border-red-500/50 bg-red-950/40 px-3 py-3 text-sm text-red-100 space-y-2">
      <div className="flex items-start gap-2">
        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
        <div className="flex-1 space-y-1">
          <p className="font-semibold">Abonnement requis — accès métier suspendu</p>
          <p className="text-xs text-red-100/90">
            {state.message ||
              "Essai ou forfait terminé. Payez via Wave puis confirmez sur WhatsApp pour réactiver caisse, stock et ventes."}
          </p>
          <pre className="text-[10px] text-red-100/70 whitespace-pre-wrap font-mono opacity-90">
            {paymentInstructions()}
          </pre>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          to="/subscription"
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-medium"
        >
          Forfaits / Payer
        </Link>
        <a
          href={wa}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium"
        >
          <MessageCircle size={14} /> WhatsApp
        </a>
        <button
          type="button"
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-400/40 text-xs"
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
