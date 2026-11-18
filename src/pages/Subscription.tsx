import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  MessageCircle,
  Wallet,
  CheckCircle2,
  Loader2,
  Crown,
  Copy,
  Check,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  PLAN,
  PLANS,
  getSubscriptionState,
  getActivePlanLimits,
  formatPlanLimitsLine,
  getPlanDisplayTitle,
  isOnTrial,
  priceForPlanMonths,
  type PlanTier,
} from '@/lib/subscription';
import { listPeriods, WAVE_NUMBER_DISPLAY, WAVE_NUMBER_RAW } from '@/lib/payments';
import {
  createPaymentRequest,
  listMyPendingRequests,
  type PaymentRequest,
} from '@/lib/paymentRequests';

export default function SubscriptionPage() {
  const { member, activeEstablishment, session, user, refresh } = useAuth();
  const [months, setMonths] = useState(1);
  const [selectedTier, setSelectedTier] = useState<PlanTier | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedWave, setCopiedWave] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<'info' | 'error' | 'ok'>('info');
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [pendingRows, setPendingRows] = useState<PaymentRequest[]>([]);
  const [waConfirmUrl, setWaConfirmUrl] = useState<string | null>(null);
  const [proofNote, setProofNote] = useState('');

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
  const [email, setEmail] = useState(user?.email || member?.email || '');
  const [phone, setPhone] = useState(
    String((member as { phone?: string } | null)?.phone || '').replace(/\D/g, '') || '',
  );

  useEffect(() => {
    if (!email && (user?.email || member?.email)) {
      setEmail(user?.email || member?.email || '');
    }
  }, [email, user?.email, member?.email]);

  const estName = activeEstablishment?.name || 'Mon établissement';
  const current = activeEstablishment ? getActivePlanLimits(activeEstablishment as any) : null;
  const displayTitle = activeEstablishment ? getPlanDisplayTitle(activeEstablishment as any) : '—';
  const onTrial = activeEstablishment ? isOnTrial(activeEstablishment as any) : false;
  const state = activeEstablishment
    ? getSubscriptionState(activeEstablishment)
    : {
        label: '—',
        blocked: false,
        message: 'Sélectionnez un établissement pour voir votre abonnement.',
        status: 'trial' as const,
      };

  const targetTier = selectedTier || (current?.id as PlanTier) || 'starter';
  const targetPlan = PLANS[targetTier];
  const amount = useMemo(() => priceForPlanMonths(targetTier, months), [targetTier, months]);

  useEffect(() => {
    if (!activeEstablishment?.id) return;
    void listMyPendingRequests(activeEstablishment.id).then((rows) => {
      setPendingRows(rows);
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

  async function copyWaveNumber() {
    try {
      await navigator.clipboard.writeText(WAVE_NUMBER_RAW);
      setCopiedWave(true);
      window.setTimeout(() => setCopiedWave(false), 2500);
    } catch {
      /* fallback silencieux */
    }
  }

  async function submitWaveRequest() {
    if (!activeEstablishment?.id || !user?.id) {
      showError('Choisissez un établissement avant de continuer.');
      return;
    }
    const err = validateIdentity();
    if (err) {
      showError(err);
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const payerName = `${String(prenom).trim()} ${String(nom).trim()}`.trim();
      const fullNote = [
        payerName ? `Payeur: ${payerName}` : null,
        phone ? `Tél: ${phone}` : null,
        proofNote.trim() ? `Réf Wave: ${proofNote.trim()}` : null,
      ]
        .filter(Boolean)
        .join(' · ');

      const res = await createPaymentRequest({
        establishmentId: activeEstablishment.id,
        userId: user.id,
        planTier: targetTier,
        months,
        paymentMethod: 'wave',
        establishmentName: activeEstablishment.name || 'Mon établissement',
        proofNote: fullNote || undefined,
      });

      const code = res.request?.reference_code || null;
      if (code) setPendingCode(code);
      setWaConfirmUrl(res.waUrl);

      const refreshedRows = await listMyPendingRequests(activeEstablishment.id);
      if (refreshedRows.length > 0) setPendingRows(refreshedRows);

      setStatusKind(res.error ? 'info' : 'ok');
      setStatus(
        `Demande enregistrée${code ? ` (${code})` : ''}. Cliquez sur « Envoyer la confirmation sur WhatsApp » ci-dessous pour activer votre forfait.`,
      );
    } catch (e: any) {
      showError(e?.message || 'Erreur lors de la création de la demande.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckActivation() {
    setRefreshing(true);
    try {
      await refresh();
      if (activeEstablishment?.id) {
        const rows = await listMyPendingRequests(activeEstablishment.id);
        setPendingRows(rows);
      }
      setStatusKind('info');
      setStatus('Statut de l’abonnement actualisé.');
    } finally {
      setRefreshing(false);
    }
  }

  const inputCls =
    'w-full rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-950 px-3 py-3 text-sm text-stone-900 dark:text-stone-100 min-h-[48px]';

  return (
    <div className="max-w-lg mx-auto space-y-5 pb-16">
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200"
        >
          <ArrowLeft size={16} /> Accueil
        </Link>
        <button
          type="button"
          onClick={() => void handleCheckActivation()}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Vérification...' : 'Vérifier mon activation'}
        </button>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
          <Wallet className="text-amber-500" size={26} /> Abonnement
        </h1>
        <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
          Paiement Wave {WAVE_NUMBER_DISPLAY} · validation WhatsApp · {PLAN.currencyLabel}
        </p>
      </div>

      {pendingCode && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 px-3.5 py-2.5 text-sm text-amber-900 dark:text-amber-100 flex items-center justify-between gap-2">
          <span>
            Demande en attente · code <strong className="font-mono">{pendingCode}</strong>
          </span>
          <Clock size={16} className="text-amber-500 shrink-0" />
        </div>
      )}

      {status && (
        <div
          className={`rounded-xl border px-3 py-2.5 text-sm ${
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

      <div
        className={`rounded-2xl border-2 p-4 space-y-2 ${
          state.blocked
            ? 'border-red-500/50 bg-red-50 dark:bg-red-950/30'
            : 'border-emerald-600/50 bg-emerald-50 dark:bg-emerald-950/30'
        }`}
      >
        <p
          className={`text-xs font-semibold uppercase tracking-wide flex items-center gap-1 ${
            state.blocked
              ? 'text-red-700 dark:text-red-300'
              : 'text-emerald-700 dark:text-emerald-400'
          }`}
        >
          <Crown size={14} /> {state.blocked ? 'Abonnement expiré / suspendu' : 'Votre forfait actuel'}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600 dark:text-stone-400" htmlFor="pay-email">
              E-mail (reçu)
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
              Téléphone payeur
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
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-stone-600 dark:text-stone-400" htmlFor="pay-ref">
            ID / Référence transaction Wave (optionnel)
          </label>
          <input
            id="pay-ref"
            value={proofNote}
            onChange={(e) => setProofNote(e.target.value)}
            placeholder="Ex : TID Wave TXN8493021..."
            className={inputCls}
          />
        </div>

        <div className="rounded-xl border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-stone-800 dark:text-amber-50 space-y-2">
          <p className="font-semibold text-amber-900 dark:text-amber-200">Paiement par Wave uniquement</p>
          <p>
            Envoyez <strong>{amount.toLocaleString('fr-FR')} F</strong> au numéro Wave :
          </p>
          <div className="flex items-center justify-center gap-3 py-1">
            <span className="text-lg font-bold tracking-wide">{WAVE_NUMBER_DISPLAY}</span>
            <button
              type="button"
              onClick={() => void copyWaveNumber()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-500/40 bg-white/80 dark:bg-stone-900 text-xs font-semibold text-amber-800 dark:text-amber-200"
            >
              {copiedWave ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              {copiedWave ? 'Copié' : 'Copier'}
            </button>
          </div>
          <p className="text-xs text-stone-600 dark:text-stone-400">
            Enregistrez votre paiement ci-dessous pour générer votre code de suivi, puis envoyez la confirmation sur WhatsApp.
          </p>
        </div>

        <button
          type="button"
          disabled={!activeEstablishment || busy}
          className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold py-3.5 px-4 flex items-center justify-center gap-2 min-h-[52px] disabled:opacity-50 shadow-lg"
          onClick={() => void submitWaveRequest()}
        >
          {busy ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
          {busy ? 'Enregistrement...' : "J'ai payé sur Wave — Enregistrer & confirmer"}
        </button>

        {waConfirmUrl && (
          <a
            href={waConfirmUrl}
            target="_blank"
            rel="noreferrer"
            className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3.5 px-4 flex items-center justify-center gap-2 min-h-[52px] shadow-lg shadow-emerald-900/20"
          >
            <MessageCircle size={20} />
            Envoyer la confirmation sur WhatsApp
          </a>
        )}

        {!activeEstablishment && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Choisissez un établissement pour finaliser.
          </p>
        )}
      </div>

      {pendingRows.length > 0 && (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/50 p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Demandes récentes en attente
          </p>
          <ul className="divide-y divide-stone-200 dark:divide-stone-800 text-xs">
            {pendingRows.map((r) => (
              <li key={r.id} className="py-2 flex items-center justify-between gap-2">
                <div>
                  <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                    {r.reference_code}
                  </span>
                  <span className="text-stone-500 ml-2">
                    {PLANS[r.plan_tier]?.label || r.plan_tier} · {r.months} mois
                  </span>
                </div>
                <span className="font-semibold text-amber-600 dark:text-amber-300">
                  {Number(r.amount_fcfa || 0).toLocaleString('fr-FR')} F
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/40 p-4 text-xs text-stone-600 dark:text-stone-400 space-y-2">
        <p className="font-medium text-stone-800 dark:text-stone-300 flex items-center gap-2">
          <CheckCircle2 size={14} className="text-amber-500" /> Après validation
        </p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Payez le montant affiché sur Wave ({WAVE_NUMBER_DISPLAY}).</li>
          <li>Cliquez sur &laquo; J&apos;ai payé sur Wave &raquo; puis envoyez le message pré-rempli sur WhatsApp.</li>
          <li>Dès activation, appuyez sur &laquo; Vérifier mon activation &raquo; en haut de la page.</li>
        </ul>
      </div>
    </div>
  );
}
