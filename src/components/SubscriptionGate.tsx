import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle, MessageCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  getSubscriptionState,
  PLAN,
  paymentInstructions,
  paymentWhatsAppLink,
} from '@/lib/subscription';

const ALLOWED_WHEN_BLOCKED = ['/settings', '/notifications', '/chat', '/subscription', '/daily-report', '/cloture', '/pos', '/inventory', '/dashboard'];

export default function SubscriptionGate() {
  const { activeEstablishment, effectiveRole, member } = useAuth();
  const location = useLocation();
  const role = String(effectiveRole || member?.role || '');
  const isPlatformAdmin = ['super_admin', 'admin'].includes(role);

  const state = getSubscriptionState(activeEstablishment as Parameters<typeof getSubscriptionState>[0]);
  const estName = activeEstablishment?.name || '';

  if (isPlatformAdmin) return null;
  if (!activeEstablishment) return null;

  const pathOk = ALLOWED_WHEN_BLOCKED.some((p) => location.pathname.startsWith(p));
  const wa = paymentWhatsAppLink(
    `Bonjour, je souhaite payer l'abonnement GESMAK.\nÉtablissement : ${estName}\nOffre : ${PLAN.monthlyFcfa} F/mois (1, 3, 6, 12 mois ou plus).`
  );

  return (
    <>
      {!state.blocked && state.message && (
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
      )}

      {state.blocked && !pathOk && (
        <div className="fixed inset-0 z-[80] bg-stone-950/95 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl border border-red-500/40 bg-stone-900 p-6 space-y-4">
            <div className="flex items-center gap-2 text-red-300">
              <AlertTriangle size={22} />
              <h2 className="text-lg font-semibold">Accès suspendu</h2>
            </div>
            <p className="text-stone-300 text-sm">{state.message}</p>
            <pre className="text-xs text-stone-400 whitespace-pre-wrap bg-stone-950/50 rounded-xl p-3 border border-stone-800">
              {paymentInstructions()}
            </pre>
            <Link
              to="/subscription"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-sky-600 text-white font-medium"
            >
              Voir les forfaits et payer (Paystack)
            </Link>
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-emerald-600 text-white font-medium"
            >
              <MessageCircle size={18} /> Contacter pour payer (WhatsApp)
            </a>
            <Link to="/settings" className="block text-center text-sm text-stone-400 hover:text-stone-200">
              Paramètres
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
