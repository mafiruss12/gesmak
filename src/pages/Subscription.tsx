import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, MessageCircle, Wallet, CheckCircle2, Loader2, Crown, CreditCard,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  PLAN, PLANS, getSubscriptionState, getActivePlanLimits, formatPlanLimitsLine,
  getPlanDisplayTitle, isOnTrial, priceForPlanMonths, type PlanTier,
} from '@/lib/subscription';
import { listPeriods, initPaystackCheckout } from '@/lib/payments';
import { createPaymentRequest, listMyPendingRequests } from '@/lib/paymentRequests';

export default function SubscriptionPage() {
  const { member, activeEstablishment, session } = useAuth();
  const [months, setMonths] = useState(1);
  const [selectedTier, setSelectedTier] = useState<PlanTier | null>(null);
  const [busy, setBusy] = useState(false);
  const [assistBusy, setAssistBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<'info' | 'error' | 'ok'>('info');
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const sessionEmail =
    (session as { user?: { email?: string } } | null)?.user?.email ||
    (member as { email?: string } | null)?.email ||
    '';
  const [email, setEmail] = useState(sessionEmail.includes('@') ? sessionEmail : '');

  const estName = activeEstablishment?.name || 'Mon établissement';
  const current = activeEstablishment ? getActivePlanLimits(activeEstablishment as any) : null;
  const displayTitle = activeEstablishment ? getPlanDisplayTitle(activeEstablishment as any) : '—';
  const onTrial = activeEstablishment ? isOnTrial(activeEstablishment as any) : false;
  const state = activeEstablishment
    ? getSubscriptionState(activeEstablishment)
    : {
        label: '—',
        message: 'Sélectionnez un établissement pour voir votre abonnement.',
        status: 'trial' as const,
      };

  const targetTier = selectedTier || (current?.id as PlanTier) || 'starter';
  const targetPlan = PLANS[targetTier];
  const amount = useMemo(
    () => priceForPlanMonths(targetTier, months),
    [targetTier, months],
  );

  useEffect(() => {
    if (sessionEmail.includes('@') && !email) setEmail(sessionEmail);
  }, [sessionEmail]);

  useEffect(() => {
    if (!activeEstablishment?.id) return;
    void listMyPendingRequests(activeEstablishment.id).then((rows) => {
      if (rows[0]?.reference_code) setPendingCode(rows[0].reference_code);
    });
  }, [activeEstablishment?.id]);

  // Retour Paystack
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const fromPs = params.get('paystack') === '1' || params.has('reference');
    if (!fromPs) return;
    const ref =
      params.get('reference') ||
      params.get('trxref') ||
      sessionStorage.getItem('sm_paystack_ref') ||
      '';
    if (!ref) {
      setStatusKind('error');
      setStatus('Retour Paystack sans référence — contactez le support avec la capture du paiement.');
      return;
    }
    let cancelled = false;
    (async () => {
      setStatusKind('info');
      setStatus('Vérification du paiement Paystack…');
      try {
        const { verifyPaystackPayment } = await import('@/lib/payments');
        const v = await verifyPaystackPayment(ref);
        if (cancelled) return;
        if (v.ok) {
          setStatusKind('ok');
          setStatus(
            `Paiement confirmé (${v.amount_fcfa?.toLocaleString('fr-FR') || '—'} F). Abonnement en cours d’activation…`,
          );
          try {
            await fetch('/api/paystack/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reference: ref, activate: true }),
            });
          } catch { /* webhook peut déjà avoir activé */ }
          setStatusKind('ok');
          setStatus('Paiement validé. Rechargez la page si le forfait ne s’affiche pas encore.');
        } else {
          setStatusKind('error');
          setStatus(v.error || `Paiement non confirmé (${v.status || 'inconnu'}).`);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setStatusKind('error');
          setStatus(e instanceof Error ? e.message : 'Erreur de vérification');
        }
      } finally {
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('paystack');
          url.searchParams.delete('reference');
          url.searchParams.delete('trxref');
          window.history.replaceState({}, '', url.pathname + url.search);
        } catch { /* */ }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const periods = listPeriods?.() ?? [
    { months: 1, label: '1 mois' },
    { months: 3, label: '3 mois' },
    { months: 6, label: '6 mois' },
    { months: 12, label: '1 an' },
  ];

  function showError(msg: string) {
    setStatusKind('error');
    setStatus(msg);
  }

  async function payPaystack() {
    if (!activeEstablishment?.id) {
      showError('Choisissez un établissement avant de payer.');
      return;
    }
    const finalEmail = String(email || '').trim();
    if (!finalEmail.includes('@') || finalEmail.length < 5) {
      showError('Indiquez un e-mail valide pour le reçu Paystack (obligatoire).');
      return;
    }
    setBusy(true);
    setStatusKind('info');
    setStatus('Ouverture sécurisée du paiement…');
    try {
      const payAmount = priceForPlanMonths(targetTier, months);
      if (!payAmount || payAmount < 100) {
        showError('Montant invalide. Choisissez un forfait et une durée.');
        return;
      }
      const ref = `SM-${activeEstablishment.id.slice(0, 8)}-${targetTier}-${months}-${Date.now()}`.slice(0, 50);
      const res = await initPaystackCheckout({
        amount: payAmount,
        email: finalEmail,
        reference: ref,
        description: `Abonnement ${targetPlan.label} — ${months} mois — ${estName}`,
        callback_url: `${window.location.origin}/subscription?paystack=1`,
        metadata: {
          establishment_id: activeEstablishment.id,
          plan_tier: targetTier,
          months,
          user_id: member?.user_id || '',
          custom_meta: `${activeEstablishment.id}|${months}|${member?.user_id || ''}|${targetTier}`,
        },
      });
      if (res.error || !res.authorization_url) {
        showError(res.error || 'Paystack indisponible. Réessayez dans un instant.');
        return;
      }
      if (res.reference) {
        try {
          sessionStorage.setItem('sm_paystack_ref', res.reference);
        } catch { /* */ }
      }
      setStatusKind('ok');
      setStatus('Redirection vers Paystack…');
      // assign plutôt que href pour fiabilité mobile
      window.location.assign(res.authorization_url);
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Erreur réseau Paystack');
    } finally {
      setBusy(false);
    }
  }

  async function payAssistance() {
    if (!activeEstablishment?.id || !member?.user_id) {
      showError('Choisissez un établissement et reconnectez-vous si besoin.');
      return;
    }
    setAssistBusy(true);
    setStatusKind('info');
    setStatus('Préparation de l’assistance paiement…');
    try {
      const r = await createPaymentRequest({
        establishmentId: activeEstablishment.id,
        userId: member.user_id,
        planTier: targetTier,
        months,
        paymentMethod: 'Assistance (WhatsApp / App)',
        establishmentName: estName,
      });
      if (r.request?.reference_code) setPendingCode(r.request.reference_code);
      setStatusKind('ok');
      setStatus(
        r.request
          ? `Demande ${r.request.reference_code} — ${targetPlan.label} · ${months} mois · ${r.request.amount_fcfa.toLocaleString('fr-FR')} F. Un conseiller vous aide à finaliser.`
          : 'Assistance ouverte. Activation après confirmation du paiement.',
      );
      if (r.waUrl) {
        window.open(r.waUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Impossible d’ouvrir l’assistance');
    } finally {
      setAssistBusy(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-5 pb-16">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200"
      >
        <ArrowLeft size={16} /> Accueil
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
          <Wallet className="text-amber-500" size={26} /> Abonnement
        </h1>
        <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
          Votre forfait et le paiement sécurisé · {PLAN.currencyLabel}
        </p>
      </div>

      {pendingCode && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          Demande en attente · code <strong>{pendingCode}</strong> — validation après paiement assisté.
        </div>
      )}

      {status && (
        <div
          className={`rounded-xl border px-3 py-2 text-sm ${
            statusKind === 'error'
              ? 'border-red-500/40 bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-100'
              : statusKind === 'ok'
                ? 'border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
                : 'border-amber-500/30 bg-amber-50/80 text-amber-950 dark:bg-amber-500/10 dark:text-amber-100'
          }`}
        >
          {status}
        </div>
      )}

      {/* Forfait actuel */}
      <div className="rounded-2xl border-2 border-emerald-600/50 bg-emerald-50 dark:bg-emerald-950/30 p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
          <Crown size={14} /> Votre forfait actuel
        </p>
        {activeEstablishment && current ? (
          <>
            <p className="text-2xl font-bold text-stone-900 dark:text-stone-50">{displayTitle}</p>
            <p className="text-sm font-medium text-stone-800 dark:text-stone-200">{estName}</p>
            <p className="text-sm text-stone-700 dark:text-stone-300">{state.message || state.label}</p>
            <p className="text-xs text-stone-600 dark:text-stone-400">
              Limites : {formatPlanLimitsLine(current)}
              {onTrial ? ' (Pro pendant l’essai)' : ''}
            </p>
            {onTrial && (
              <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                Après l’essai : Essentiel {PLANS.starter.monthlyFcfa.toLocaleString('fr-FR')} F/mois, ou Pro{' '}
                {PLANS.pro.monthlyFcfa.toLocaleString('fr-FR')} F/mois.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-stone-600 dark:text-stone-400">Aucun établissement sélectionné.</p>
        )}
      </div>

      {/* Choix forfait */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">Choisir un forfait</p>
        <div className="grid gap-2">
          {(Object.keys(PLANS) as PlanTier[]).map((id) => {
            const p = PLANS[id];
            const isSelected = targetTier === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedTier(id)}
                className={`text-left rounded-xl border-2 px-4 py-3 transition ${
                  isSelected
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40'
                    : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-stone-900 dark:text-stone-100">{p.label}</span>
                  <span className="text-amber-700 dark:text-amber-300 font-semibold">
                    {p.monthlyFcfa.toLocaleString('fr-FR')} F/mois
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-1">{formatPlanLimitsLine(p)}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Durée */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">Durée</p>
        <div className="flex flex-wrap gap-2">
          {periods.map((p: { months: number; label: string }) => (
            <button
              key={p.months}
              type="button"
              onClick={() => setMonths(p.months)}
              className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                months === p.months
                  ? 'border-amber-500 bg-amber-500 text-white'
                  : 'border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-300'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Montant + paiement */}
      <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900/60 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-stone-600 dark:text-stone-400">
            À payer · {targetPlan.label} · {months} mois
          </span>
          <span className="text-xl font-bold text-amber-700 dark:text-amber-300">
            {amount.toLocaleString('fr-FR')} F
          </span>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-stone-600 dark:text-stone-400" htmlFor="pay-email">
            E-mail pour le reçu (obligatoire)
          </label>
          <input
            id="pay-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ex. vous@email.com"
            className="w-full rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-950 px-3 py-3 text-sm text-stone-900 dark:text-stone-100 min-h-[48px]"
          />
        </div>

        {/* UN SEUL bouton de paiement */}
        <button
          type="button"
          disabled={busy || !activeEstablishment}
          className="w-full rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-semibold py-3.5 px-4 flex items-center justify-center gap-2 min-h-[52px] disabled:opacity-50 shadow-lg shadow-sky-900/20"
          onClick={() => void payPaystack()}
        >
          {busy ? <Loader2 className="animate-spin" size={20} /> : <CreditCard size={20} />}
          {busy ? 'Connexion à Paystack…' : `Payer ${amount.toLocaleString('fr-FR')} F maintenant`}
        </button>

        {/* Assistance — pas un 2e paiement concurrent */}
        <button
          type="button"
          disabled={assistBusy || !activeEstablishment}
          className="w-full rounded-xl border-2 border-emerald-600/60 bg-transparent hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 font-medium py-3 px-4 flex items-center justify-center gap-2 min-h-[48px] disabled:opacity-50"
          onClick={() => void payAssistance()}
        >
          {assistBusy ? <Loader2 className="animate-spin" size={18} /> : <MessageCircle size={18} />}
          Besoin d’aide ? Assistance paiement (App / WhatsApp)
        </button>

        {!activeEstablishment && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Choisissez un établissement pour finaliser le paiement.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/40 p-4 text-xs text-stone-600 dark:text-stone-400 space-y-2">
        <p className="font-medium text-stone-800 dark:text-stone-300 flex items-center gap-2">
          <CheckCircle2 size={14} className="text-amber-500" /> Comment ça marche
        </p>
        <ul className="space-y-1 list-disc list-inside">
          <li>
            <strong>Payer maintenant</strong> : carte ou Mobile Money via Paystack — activation automatique.
          </li>
          <li>
            <strong>Assistance</strong> : un message WhatsApp / suivi app pour vous aider à payer (validation manuelle).
          </li>
          <li>Le montant affiché = forfait choisi × durée.</li>
        </ul>
      </div>
    </div>
  );
}
