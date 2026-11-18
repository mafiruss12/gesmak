import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle, Building2, MessageCircle, RefreshCw, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  getSubscriptionState,
  PLAN,
  paymentInstructions,
  paymentWhatsAppLink,
} from '@/lib/subscription';

const ALLOWED_WHEN_BLOCKED = ['/settings', '/notifications', '/chat', '/subscription'];

export default function SubscriptionGate() {
  const {
    activeEstablishment,
    myEstablishments,
    switchEstablishment,
    effectiveRole,
    member,
    refresh,
  } = useAuth();
  const location = useLocation();
  const [refreshing, setRefreshing] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [switchErr, setSwitchErr] = useState<string | null>(null);

  const role = String(effectiveRole || member?.role || '').toLowerCase();
  const isPlatformAdmin = ['super_admin', 'admin'].includes(role);
  const isOwner = role === 'owner';

  const state = getSubscriptionState(activeEstablishment as Parameters<typeof getSubscriptionState>[0]);
  const estName = activeEstablishment?.name || '';

  if (isPlatformAdmin) return null;
  if (!activeEstablishment) return null;

  const pathOk = ALLOWED_WHEN_BLOCKED.some((p) => location.pathname.startsWith(p));
  const otherSites = myEstablishments.filter((e) => e.id !== activeEstablishment.id);
  const wa = paymentWhatsAppLink(
    `Bonjour, je souhaite payer et réactiver l'abonnement GESMAK.\nÉtablissement : ${estName}\nOffre : à partir de ${PLAN.monthlyFcfa.toLocaleString('fr-FR')} F/mois.`,
  );

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <>
      {!state.blocked && state.message && (state.status === 'past_due' || (state.daysLeft != null && state.daysLeft <= 7)) && (
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
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-600 text-white text-xs font-medium"
              >
                Payer / Forfaits
              </Link>
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-medium"
              >
                <MessageCircle size={14} /> WhatsApp
              </a>
            </>
          )}
        </div>
      )}

      {state.blocked && !pathOk && (
        <div className="fixed inset-0 z-[80] bg-stone-950/95 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-md w-full rounded-2xl border border-red-500/40 bg-stone-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0 text-red-400">
                {isOwner ? <AlertTriangle size={22} /> : <ShieldAlert size={22} />}
              </div>
              <div>
                <h2 className="text-lg font-bold text-stone-100">
                  {isOwner ? 'Accès suspendu — Abonnement requis' : 'Établissement temporairement suspendu'}
                </h2>
                <p className="text-xs text-red-300 font-medium mt-0.5">{estName}</p>
              </div>
            </div>

            <p className="text-stone-300 text-sm leading-relaxed">
              {isOwner
                ? state.message
                : `La période d'essai ou l'abonnement de « ${estName} » est arrivé à expiration. Contactez le propriétaire de l'établissement pour régulariser le paiement, puis actualisez.`}
            </p>

            {isOwner && (
              <pre className="text-xs text-stone-300 whitespace-pre-wrap bg-stone-950/60 rounded-xl p-3 border border-stone-800 leading-relaxed">
                {paymentInstructions()}
              </pre>
            )}

            <div className="space-y-2.5">
              {isOwner && (
                <>
                  <Link
                    to="/subscription"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold transition"
                  >
                    Choisir un forfait et payer (Wave)
                  </Link>
                  <a
                    href={wa}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition"
                  >
                    <MessageCircle size={18} /> Confirmer sur WhatsApp
                  </a>
                </>
              )}

              <button
                type="button"
                disabled={refreshing}
                onClick={() => void handleRefresh()}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-stone-700 bg-stone-800 hover:bg-stone-700 text-stone-100 text-sm font-medium transition disabled:opacity-60"
              >
                <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                {refreshing ? 'Vérification...' : "Vérifier l'activation / Actualiser"}
              </button>
            </div>

            {otherSites.length > 0 && (
              <div className="pt-2 border-t border-stone-800 space-y-2">
                <p className="text-xs font-semibold text-stone-400 flex items-center gap-1.5">
                  <Building2 size={14} /> Basculer vers un autre établissement
                </p>
                <div className="flex flex-wrap gap-2">
                  {otherSites.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      disabled={switchingId === s.id}
                      onClick={async () => {
                        setSwitchingId(s.id);
                        setSwitchErr(null);
                        try {
                          await switchEstablishment(s.id);
                        } catch (err: unknown) {
                          setSwitchErr(err instanceof Error ? err.message : 'Impossible de basculer');
                        } finally {
                          setSwitchingId(null);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg border border-stone-700 bg-stone-950 text-xs font-medium text-stone-200 hover:border-amber-500/60"
                    >
                      {switchingId === s.id ? 'Changement...' : s.name}
                    </button>
                  ))}
                </div>
                {switchErr && <p className="text-xs text-red-300">{switchErr}</p>}
              </div>
            )}

            <div className="flex items-center justify-center gap-4 text-xs text-stone-400 pt-1">
              <Link to="/settings" className="hover:text-stone-200 underline">
                Paramètres
              </Link>
              <span>·</span>
              <Link to="/chat" className="hover:text-stone-200 underline">
                Chat équipe
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
