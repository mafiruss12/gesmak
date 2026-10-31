import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, MessageCircle, Wallet, CheckCircle2, Loader2, Crown,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  PLAN, PLANS, getSubscriptionState, getActivePlanLimits, formatPlanLimitsLine,
  getPlanDisplayTitle, isOnTrial, priceForPlanMonths, type PlanTier,
} from '@/lib/subscription';
import { listPeriods, openSubscriptionWhatsApp, WAVE_NUMBER_DISPLAY } from '@/lib/payments';
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
    if (!String(prenom).trim() && !String(nom).trim()) return 'Indiquez au moins votre nom ou prénom.';
    return null;
  }



  function payWaveWhatsApp() {
    if (!activeEstablishment?.id) {
      showError('Choisissez un établissement avant de continuer.');
      return;
    }
    const err = validateIdentity();
    if (err) {
      showError(err);
      return;
    }
    const payAmount = priceForPlanMonths(targetTier, months);
    const payerName = `${String(prenom).trim()} ${String(nom).trim()}`.trim();
    setStatusKind('info');
    setStatus(
      `1) Payez ${payAmount.toLocaleString('fr-FR')} F sur Wave ${WAVE_NUMBER_DISPLAY}. 2) Confirmez sur WhatsApp — activation après vérification.`,
    );
    openSubscriptionWhatsApp({
      establishmentName: activeEstablishment.name || 'Mon établissement',
      months,
      planLabel: PLANS[targetTier]?.label || targetTier,
      amount: payAmount,
      payerName: payerName || undefined,
    });
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

        <div className="rounded-xl border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-stone-800 dark:text-amber-50 space-y-2">
          <p className="font-semibold text-amber-900 dark:text-amber-200">Paiement par Wave uniquement</p>
          <p>
            Envoyez <strong>{amount.toLocaleString('fr-FR')} F</strong> au numéro Wave :
          </p>
          <p className="text-lg font-bold tracking-wide text-center py-1">{WAVE_NUMBER_DISPLAY}</p>
          <p className="text-xs text-stone-600 dark:text-stone-400">
            Puis cliquez sur le bouton WhatsApp pour nous envoyer la confirmation. Après vérification, nous activons votre abonnement.
          </p>
        </div>

        <button
          type="button"
          disabled={!activeEstablishment}
          className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3.5 px-4 flex items-center justify-center gap-2 min-h-[52px] disabled:opacity-50 shadow-lg shadow-emerald-900/20"
          onClick={() => payWaveWhatsApp()}
        >
          <MessageCircle size={20} />
          J&apos;ai payé sur Wave — confirmer sur WhatsApp
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
          <li>Payez le montant affiché sur Wave ({WAVE_NUMBER_DISPLAY}).</li>
          <li>Confirmez par WhatsApp (capture ou message).</li>
          <li>Nous vérifions le paiement puis activons votre abonnement manuellement.</li>
        </ul>
      </div>
    </div>
  );
}
