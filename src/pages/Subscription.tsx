import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, MessageCircle, Wallet, CheckCircle2, Loader2, Crown,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  PLAN, PLANS, getSubscriptionState, getEffectivePlan, getPlanLimits,
  getPlanDisplayTitle, getActivePlanLimits, formatPlanLimitsLine, isOnTrial,
  priceForMonths, priceForPlanMonths, type PlanTier,
} from '@/lib/subscription';
import {
  PAYMENT_METHODS,
  listPeriods,
  initPaystackCheckout,
  isPaystackConfigured,
} from '@/lib/payments';
import { createPaymentRequest, listMyPendingRequests } from '@/lib/paymentRequests';

export default function SubscriptionPage() {
  const { member, activeEstablishment, session } = useAuth();
  const [months, setMonths] = useState(1);
  const [method, setMethod] = useState('whatsapp');
  const [selectedTier, setSelectedTier] = useState<PlanTier | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  const estName = activeEstablishment?.name || 'Mon établissement';
  const current = activeEstablishment ? getActivePlanLimits(activeEstablishment as any) : null;
  const limits = current;
  const displayTitle = activeEstablishment ? getPlanDisplayTitle(activeEstablishment as any) : '—';
  const onTrial = activeEstablishment ? isOnTrial(activeEstablishment as any) : false;
  const state = activeEstablishment
    ? getSubscriptionState(activeEstablishment)
    : { label: '—', message: 'Sélectionnez un établissement pour voir votre abonnement.', status: 'trial' as const };

  const targetTier = selectedTier || (current?.id as PlanTier) || 'starter';
  const targetPlan = PLANS[targetTier];
  const amount = useMemo(() => {
    const monthly = targetPlan.monthlyFcfa;
    return monthly * Math.max(1, months);
  }, [targetPlan, months]);


  useEffect(() => {
    if (!activeEstablishment?.id) return;
    void listMyPendingRequests(activeEstablishment.id).then((rows) => {
      if (rows[0]?.reference_code) setPendingCode(rows[0].reference_code);
    });
  }, [activeEstablishment?.id]);

  // Retour Paystack : ?paystack=1&reference=... ou reference seule
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const fromPs = params.get('paystack') === '1' || params.has('reference');
    if (!fromPs) return;
    const ref =
      params.get('reference') ||
      params.get('trxref') ||
      (() => { try { return sessionStorage.getItem('sm_paystack_ref'); } catch { return null; } })();
    if (!ref) {
      setStatus('Retour Paystack sans référence — contactez le support avec la capture du paiement.');
      return;
    }
    let cancelled = false;
    (async () => {
      setBusy(true);
      setStatus('Vérification du paiement Paystack…');
      try {
        const { verifyPaystackPayment } = await import('@/lib/payments');
        const v = await verifyPaystackPayment(ref);
        if (cancelled) return;
        if (v.ok) {
          setStatus(`Paiement confirmé (${v.amount_fcfa?.toLocaleString('fr-FR') || '—'} F). Abonnement en cours d’activation…`);
          // Appelle activate côté serveur
          await fetch('/api/paystack/activate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reference: ref }),
          }).catch(() => null);
          setStatus(`Paiement confirmé (${v.amount_fcfa?.toLocaleString('fr-FR') || '—'} F). Rechargez la page si le forfait n’est pas encore à jour.`);
        } else {
          setStatus(v.error || `Paiement non confirmé (statut: ${v.status || 'inconnu'}).`);
        }
      } catch (e: unknown) {
        if (!cancelled) setStatus(e instanceof Error ? e.message : 'Erreur de vérification');
      } finally {
        if (!cancelled) setBusy(false);
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('paystack');
          url.searchParams.delete('reference');
          url.searchParams.delete('trxref');
          window.history.replaceState({}, '', url.pathname + url.search);
        } catch { /* */ }
      }
    })();
    return () => { cancelled = true; };
  }, []);


  const periods = listPeriods?.() ?? [
    { months: 1, label: '1 mois' },
    { months: 3, label: '3 mois' },
    { months: 6, label: '6 mois' },
    { months: 12, label: '1 an' },
  ];


  async function payPaystack() {
    if (!activeEstablishment?.id) {
      setStatus('Choisissez un établissement.');
      return;
    }
    const email =
      (session as { user?: { email?: string } } | null)?.user?.email ||
      (member as { email?: string } | null)?.email ||
      '';
    const finalEmail =
      email && String(email).includes('@')
        ? String(email)
        : (typeof window !== 'undefined' ? window.prompt('Email pour le reçu Paystack') || '' : '');
    if (!finalEmail || !String(finalEmail).includes('@')) {
      setStatus('Email requis pour payer avec Paystack.');
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      // Montant = plan choisi × durée (identique à l’affichage)
      const payAmount = priceForPlanMonths(targetTier, months);
      const ref = `SM-${activeEstablishment.id.slice(0, 8)}-${targetTier}-${months}-${Date.now()}`;
      const res = await initPaystackCheckout({
        amount: payAmount,
        email: String(finalEmail).trim(),
        reference: ref.slice(0, 50),
        description: `Abonnement ${targetPlan.label} — ${months} mois — ${activeEstablishment.name || ''}`,
        callback_url: `${window.location.origin}/subscription?paystack=1`,
        metadata: {
          establishment_id: activeEstablishment.id,
          plan_tier: targetTier,
          months,
          user_id: member?.user_id || '',
          // format legacy pour webhook: est|months|user
          custom_meta: `${activeEstablishment.id}|${months}|${member?.user_id || ''}|${targetTier}`,
        },
      });
      if (res.error || !res.authorization_url) {
        setStatus(res.error || 'Paystack indisponible. Vérifiez PAYSTACK_SECRET_KEY sur le serveur.');
        return;
      }
      if (res.reference) {
        try { sessionStorage.setItem('sm_paystack_ref', res.reference); } catch { /* */ }
      }
      window.location.href = res.authorization_url;
    } catch (e: unknown) {
      setStatus(e instanceof Error ? e.message : 'Erreur Paystack');
    } finally {
      setBusy(false);
    }
  }

  async function payWhatsApp() {
    if (!activeEstablishment?.id || !member?.user_id) {
      setStatus('Choisissez un établissement et reconnectez-vous si besoin.');
      return;
    }
    setBusy(true);
    setStatus(null);
    const r = await createPaymentRequest({
      establishmentId: activeEstablishment.id,
      userId: member.user_id,
      planTier: targetTier,
      months,
      paymentMethod: PAYMENT_METHODS.find((m) => m.id === method)?.label || method,
      establishmentName: estName,
    });
    setBusy(false);
    if (r.request?.reference_code) setPendingCode(r.request.reference_code);
    setStatus(
      r.request
        ? `Demande ${r.request.reference_code} — ${targetPlan.label} · ${months} mois · ${r.request.amount_fcfa.toLocaleString('fr-FR')} F. WhatsApp ouvert ; activation après validation.`
        : 'WhatsApp ouvert. Activation après confirmation du paiement.'
    );
    window.open(r.waUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="max-w-lg mx-auto space-y-5 pb-16">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200">
        <ArrowLeft size={16} /> Accueil
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
          <Wallet className="text-amber-500" size={26} /> Abonnement
        </h1>
        <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
          Votre forfait actuel et les offres disponibles · {PLAN.currencyLabel}
        </p>
      </div>

      {pendingCode && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          Demande en attente · code <strong>{pendingCode}</strong> — validation admin après paiement.
        </div>
      )}

      {/* Forfait actuel — toujours clair */}
      <div className="rounded-2xl border-2 border-emerald-600/50 bg-emerald-50 dark:bg-emerald-950/30 p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
          <Crown size={14} /> Votre forfait actuel
        </p>
        {activeEstablishment && current ? (
          <>
            <p className="text-2xl font-bold text-stone-900 dark:text-stone-50">{displayTitle}</p>
            <p className="text-sm font-medium text-stone-800 dark:text-stone-200">{estName}</p>
            <p className="text-sm text-stone-700 dark:text-stone-300">{state.message || state.label}</p>
            {limits && (
              <p className="text-xs text-stone-600 dark:text-stone-400">
                Limites actives : {formatPlanLimitsLine(limits)}
                {onTrial ? ' (Pro pendant l’essai)' : ''}
                {limits.qrOrdering ? ' · QR' : ''}
                {limits.multiSite ? ' · Multi-sites' : ''}
                {limits.ocrAi ? ' · IA' : ''}
              </p>
            )}
            {onTrial && (
              <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                Après l’essai : Essentiel à {PLANS.starter.monthlyFcfa.toLocaleString('fr-FR')} F/mois, ou restez en Pro à {PLANS.pro.monthlyFcfa.toLocaleString('fr-FR')} F/mois.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-stone-700 dark:text-stone-300">{state.message}</p>
        )}
      </div>

      {/* Autres / tous les forfaits */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-stone-800 dark:text-stone-200">Tous les forfaits</h2>
        <p className="text-xs text-stone-500 dark:text-stone-500">
          Choisissez une offre pour payer ou upgrader. Votre forfait actuel est indiqué.
        </p>
        {(['starter', 'pro', 'business'] as PlanTier[]).map((id) => {
          const p = PLANS[id];
          const isCurrent = current?.id === id;
          const isSelected = targetTier === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSelectedTier(id)}
              className={`w-full text-left rounded-2xl border p-4 transition ${
                isCurrent
                  ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-900/20'
                  : isSelected
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20'
                    : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900/50'
              }`}
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="font-bold text-stone-900 dark:text-stone-100">{p.label}</p>
                  <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
                    {p.maxEstablishments} site(s) · {p.maxEmployees} employés · {p.maxProducts} produits
                  </p>
                  <p className="text-xs text-stone-500 mt-1">
                    {[
                      p.qrOrdering && 'QR',
                      p.kitchen && 'Cuisine',
                      p.multiSite && 'Multi-sites',
                      p.ocrAi && 'IA',
                      p.advancedReports && 'Rapports+',
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Essentiel stock & caisse'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {isCurrent && (
                    <span className="block text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-400 mb-1">
                      Actuel
                    </span>
                  )}
                  <p className="font-semibold text-stone-900 dark:text-stone-100">
                    {p.monthlyFcfa.toLocaleString('fr-FR')} F
                  </p>
                  <p className="text-[10px] text-stone-500">/ mois</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Durée + moyen + payer */}
      <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900/40 p-4 space-y-3">
        <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">
          Payer : <span className="text-amber-700 dark:text-amber-300">{targetPlan.label}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {periods.map((per: { months: number; label: string }) => (
            <button
              key={per.months}
              type="button"
              onClick={() => setMonths(per.months)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                months === per.months
                  ? 'border-amber-500 bg-amber-500/15 text-amber-800 dark:text-amber-200'
                  : 'border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300'
              }`}
            >
              {per.label}
            </button>
          ))}
        </div>
        <p className="text-lg font-bold text-stone-900 dark:text-stone-100">
          {amount.toLocaleString('fr-FR')} {PLAN.currencyLabel}
          <span className="text-sm font-normal text-stone-500"> · {months} mois</span>
        </p>

        <div className="flex flex-wrap gap-2">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMethod(m.id)}
              className={`px-2.5 py-1.5 rounded-lg text-xs border ${
                method === m.id
                  ? 'border-amber-500 bg-amber-500/15 text-amber-900 dark:text-amber-100'
                  : 'border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-400'
              }`}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={busy || !activeEstablishment}
          className="btn-primary w-full flex items-center justify-center gap-2 min-h-[48px]"
          onClick={() => void payWhatsApp()}
        >
          {busy ? <Loader2 className="animate-spin" size={18} /> : <MessageCircle size={18} />}
          Payer via WhatsApp (validation manuelle)
        </button>
        <button
          type="button"
          disabled={busy || !activeEstablishment}
          className="w-full rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold py-3 px-4 flex items-center justify-center gap-2 min-h-[48px] disabled:opacity-50"
          onClick={() => void payPaystack()}
        >
          {busy ? <Loader2 className="animate-spin" size={18} /> : null}
          Payer avec Paystack (carte / Mobile Money)
        </button>
        {!activeEstablishment && (
          <p className="text-xs text-amber-700 dark:text-amber-300">Choisissez un établissement pour finaliser le paiement.</p>
        )}
        {status && (
          <p className="text-xs text-stone-700 dark:text-amber-100 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
            {status}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/40 p-4 text-xs text-stone-600 dark:text-stone-400 space-y-2">
        <p className="font-medium text-stone-800 dark:text-stone-300 flex items-center gap-2">
          <CheckCircle2 size={14} className="text-amber-500" /> Comment ça marche
        </p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Votre forfait actuel est toujours affiché en vert ci-dessus.</li>
          <li>Sélectionnez un autre forfait pour upgrader ou renouveler.</li>
          <li><strong>Paystack</strong> : carte ou Mobile Money — activation automatique après paiement.</li>
          <li><strong>WhatsApp</strong> : validation manuelle par l’admin (Wave/MTN/Orange hors app).</li>
          <li>Le montant affiché est toujours celui du forfait choisi × la durée.</li>
        </ul>
        {member?.role && (
          <p className="pt-1 text-stone-500">Connecté en tant que : {member.role}</p>
        )}
      </div>
    </div>
  );
}
