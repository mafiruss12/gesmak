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

  const sessionName =
    (member as { full_name?: string; name?: string } | null)?.full_name ||
    (member as { name?: string } | null)?.name ||
    (session as { user?: { user_metadata?: { full_name?: string; name?: string } } } | null)?.user
      ?.user_metadata?.full_name ||
    (session as { user?: { user_metadata?: { name?: string } } } | null)?.user?.user_metadata?.name ||
    '';

  const nameParts = String(sessionName || '').trim().split(/\s+/).filter(Boolean);
  const [prenom, setPrenom] = useState(nameParts[0] || '');
  const [nom, setNom] = useState(nameParts.length > 1 ? nameParts.slice(1).join(' ') : '');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState(
    String((member as { phone?: string } | null)?.phone || '').replace(/\D/g, '') || '',
  );

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
  const amount = useMemo(() => priceForPlanMonths(targetTier, months), [targetTier, months]);
useEffect(() => {
    if (!activeEstablishment?.id) return;
    void listMyPendingRequests(activeEstablishment.id).then((rows) => {
      if (rows[0]?.reference_code) setPendingCode(rows[0].reference_code);
    });
  }, [activeEstablishment?.id]);

  // Retour Paystack → vérifier + activer abonnement
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const fromPs = params.get('paystack') === '1' || params.has('reference') || params.has('trxref');
    if (!fromPs) return;
    const ref =
      params.get('reference') ||
      params.get('trxref') ||
      sessionStorage.getItem('sm_paystack_ref') ||
      '';
    if (!ref) {
      setStatusKind('error');
      setStatus('Retour Paystack sans référence. Contactez le support avec la capture du paiement.');
      return;
    }
    let cancelled = false;
    (async () => {
      setStatusKind('info');
      setStatus('Vérification du paiement et activation de l’abonnement…');
      try {
        // 1) Vérifier auprès de Paystack
        const vRes = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(ref)}`);
        const v = await vRes.json().catch(() => ({}));
        if (cancelled) return;
        if (!v?.ok && v?.status !== 'success') {
          setStatusKind('error');
          setStatus(v?.error || `Paiement non confirmé (${v?.status || 'inconnu'}).`);
          return;
        }
        // 2) Activer l’abonnement côté serveur (service role)
        const aRes = await fetch('/api/paystack/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reference: ref, activate: true }),
        });
        const act = await aRes.json().catch(() => ({}));
        if (cancelled) return;
        if (aRes.ok && (act?.ok || act?.activation?.ok || act?.status === 'ALREADY_PROCESSED')) {
          setStatusKind('ok');
          setStatus(
            'Paiement validé. Votre abonnement est activé. Rechargez la page si le forfait ne s’affiche pas encore.',
          );
          try {
            sessionStorage.removeItem('sm_paystack_ref');
          } catch { /* */ }
          // recharger le profil établissement après court délai
          setTimeout(() => {
            try {
              window.location.href = '/subscription';
            } catch { /* */ }
          }, 1800);
        } else {
          setStatusKind('ok');
          setStatus(
            `Paiement reçu (${v?.amount_fcfa?.toLocaleString?.('fr-FR') || '—'} F). Activation en cours — si le forfait ne change pas sous 1 min, contactez le support avec la référence ${ref}.`,
          );
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
          window.history.replaceState({}, '', url.pathname + (url.search || ''));
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

  function validateIdentity(): string | null {
    if (!String(prenom).trim()) return 'Indiquez votre prénom.';
    if (!String(nom).trim()) return 'Indiquez votre nom.';
    const em = String(email).trim();
    if (!em.includes('@') || em.length < 5) return 'Indiquez un e-mail valide pour le reçu.';
    return null;
  }

  async function payPaystack() {
    if (!activeEstablishment?.id) {
      showError('Choisissez un établissement avant de payer.');
      return;
    }
    const err = validateIdentity();
    if (err) {
      showError(err);
      return;
    }
    setBusy(true);
    setStatusKind('info');
    setStatus('Préparation du paiement sécurisé…');
    try {
      const payAmount = priceForPlanMonths(targetTier, months);
      if (!payAmount || payAmount < 100) {
        showError('Montant invalide. Choisissez un forfait et une durée.');
        return;
      }
      const fullName = `${prenom.trim()} ${nom.trim()}`.trim();
      const ref = `SM-${activeEstablishment.id.slice(0, 8)}-${targetTier}-${months}-${Date.now()}`.slice(0, 50);
      const res = await initPaystackCheckout({
        amount: payAmount,
        email: email.trim(),
        reference: ref,
        description: `Abonnement ${targetPlan.label} — ${months} mois — ${estName} — ${fullName}`,
        callback_url: `${window.location.origin}/subscription?paystack=1`,
        metadata: {
          establishment_id: activeEstablishment.id,
          plan_tier: targetTier,
          months,
          user_id: member?.user_id || '',
          customer_first_name: prenom.trim(),
          customer_last_name: nom.trim(),
          customer_name: fullName,
          customer_phone: phone.trim() || null,
          custom_meta: `${activeEstablishment.id}|${months}|${member?.user_id || ''}|${targetTier}`,
        },
      });
      if (res.error || !res.authorization_url) {
        showError(res.error || 'Paiement indisponible. Réessayez dans un instant.');
        return;
      }
      if (res.reference) {
        try {
          sessionStorage.setItem('sm_paystack_ref', res.reference);
          sessionStorage.setItem('sm_pay_name', fullName);
        } catch { /* */ }
      }
      setStatusKind('ok');
      setStatus('Redirection vers la page de paiement sécurisée…');
      window.location.assign(res.authorization_url);
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Erreur réseau paiement');
    } finally {
      setBusy(false);
    }
  }

  async function payAssistance() {
    if (!activeEstablishment?.id || !member?.user_id) {
      showError('Choisissez un établissement et reconnectez-vous si besoin.');
      return;
    }
    const err = validateIdentity();
    if (err) {
      showError(err);
      return;
    }
    setAssistBusy(true);
    setStatusKind('info');
    setStatus('Ouverture de l’assistance paiement…');
    try {
      const r = await createPaymentRequest({
        establishmentId: activeEstablishment.id,
        userId: member.user_id,
        planTier: targetTier,
        months,
        paymentMethod: `Assistance — ${prenom.trim()} ${nom.trim()}`.trim(),
        establishmentName: estName,
      });
      if (r.request?.reference_code) setPendingCode(r.request.reference_code);
      setStatusKind('ok');
      setStatus(
        r.request
          ? `Demande ${r.request.reference_code} — ${targetPlan.label} · ${months} mois · ${r.request.amount_fcfa.toLocaleString('fr-FR')} F.`
          : 'Assistance ouverte.',
      );
      if (r.waUrl) window.open(r.waUrl, '_blank', 'noopener,noreferrer');
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Impossible d’ouvrir l’assistance');
    } finally {
      setAssistBusy(false);
    }
  }

  const inputCls =
    'w-full rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-950 px-3 py-3 text-sm text-stone-900 dark:text-stone-100 min-h-[48px]';

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
          Paiement sécurisé · activation automatique · {PLAN.currencyLabel}
        </p>
      </div>

      {pendingCode && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          Demande en attente · code <strong>{pendingCode}</strong>
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
          </>
        ) : (
          <p className="text-sm text-stone-600 dark:text-stone-400">Aucun établissement sélectionné.</p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">1. Choisir un forfait</p>
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

      <div className="space-y-2">
        <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">2. Durée</p>
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

      <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900/60 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-stone-600 dark:text-stone-400">
            3. Identité & paiement · {targetPlan.label} · {months} mois
          </span>
          <span className="text-xl font-bold text-amber-700 dark:text-amber-300">
            {amount.toLocaleString('fr-FR')} F
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600 dark:text-stone-400" htmlFor="pay-prenom">
              Prénom *
            </label>
            <input
              id="pay-prenom"
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              className={inputCls}
              autoComplete="given-name"
              placeholder="Prénom"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600 dark:text-stone-400" htmlFor="pay-nom">
              Nom *
            </label>
            <input
              id="pay-nom"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className={inputCls}
              autoComplete="family-name"
              placeholder="Nom"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-stone-600 dark:text-stone-400" htmlFor="pay-email">
            E-mail (reçu) *
          </label>
          <input
            id="pay-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@email.com"
            className={inputCls}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-stone-600 dark:text-stone-400" htmlFor="pay-phone">
            Téléphone (optionnel)
          </label>
          <input
            id="pay-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="07XXXXXXXX"
            className={inputCls}
          />
        </div>

        <p className="text-xs text-stone-500 dark:text-stone-400">
          Carte bancaire ou Mobile Money : saisis sur la page sécurisée Paystack après validation (nous ne stockons pas vos numéros de carte).
        </p>

        <button
          type="button"
          disabled={busy || !activeEstablishment}
          className="w-full rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-semibold py-3.5 px-4 flex items-center justify-center gap-2 min-h-[52px] disabled:opacity-50 shadow-lg shadow-sky-900/20"
          onClick={() => void payPaystack()}
        >
          {busy ? <Loader2 className="animate-spin" size={20} /> : <CreditCard size={20} />}
          {busy
            ? 'Connexion au paiement…'
            : `Valider et payer ${amount.toLocaleString('fr-FR')} F`}
        </button>

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
            Choisissez un établissement pour finaliser.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/40 p-4 text-xs text-stone-600 dark:text-stone-400 space-y-2">
        <p className="font-medium text-stone-800 dark:text-stone-300 flex items-center gap-2">
          <CheckCircle2 size={14} className="text-amber-500" /> Après validation
        </p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Vous renseignez nom, prénom et e-mail ici.</li>
          <li>Paystack gère carte / Mobile Money de façon sécurisée.</li>
          <li>Dès confirmation, l’abonnement est accordé automatiquement à votre établissement.</li>
        </ul>
      </div>
    </div>
  );
}
