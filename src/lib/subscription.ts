/** Offre commerciale GESMAK CI */

/** Tarifs de référence (affichage commercial) */
export const PLAN = {
  /** Référence affichage = offre Essentiel (entrée) */
  setupStockFcfa: 12_000,
  setupTrainingFcfa: 0,
  setupTotalFcfa: 12_000,
  monthlyFcfa: 7_000,
  trialDays: 30,
  graceDays: 3,
  currencyLabel: 'F CFA',
} as const;

/** Plans Starter / Pro — limites d’accès dans l’app */
export type PlanTier = 'starter' | 'pro' | 'business';

export type PlanLimits = {
  id: PlanTier;
  label: string;
  setupFcfa: number;
  monthlyFcfa: number;
  maxEstablishments: number;
  maxEmployees: number;
  maxProducts: number;
  /** Commande QR / tables */
  qrOrdering: boolean;
  /** Cuisine / file d’attente */
  kitchen: boolean;
  /** Multi-établissements (switch) */
  multiSite: boolean;
  /** OCR Gemini / analyse tickets */
  ocrAi: boolean;
  /** Rapports semaine/mois auto avancés */
  advancedReports: boolean;
  /** Support prioritaire (affichage) */
  prioritySupport: boolean;
};

export const PLANS: Record<PlanTier, PlanLimits> = {
  starter: {
    id: 'starter',
    label: 'Essentiel',
    setupFcfa: 12_000,
    monthlyFcfa: 7_000,
    maxEstablishments: 1,
    maxEmployees: 3,
    maxProducts: 80,
    qrOrdering: false,
    kitchen: false,
    multiSite: false,
    ocrAi: false,
    advancedReports: false,
    prioritySupport: false,
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    setupFcfa: 30_000,
    monthlyFcfa: 15_000,
    maxEstablishments: 3,
    maxEmployees: 8,
    maxProducts: 500,
    qrOrdering: true,
    kitchen: true,
    multiSite: true,
    ocrAi: true,
    advancedReports: true,
    prioritySupport: true,
  },
  business: {
    id: 'business',
    label: 'Business',
    setupFcfa: 100_000,
    monthlyFcfa: 35_000,
    maxEstablishments: 20,
    maxEmployees: 100,
    maxProducts: 5_000,
    qrOrdering: true,
    kitchen: true,
    multiSite: true,
    ocrAi: true,
    advancedReports: true,
    prioritySupport: true,
  },
};

export function normalizePlanTier(raw: string | null | undefined): PlanTier {
  const v = String(raw || 'starter').toLowerCase();
  if (v === 'pro' || v === 'professional') return 'pro';
  if (v === 'business' || v === 'entreprise') return 'business';
  return 'starter';
}

export function getPlanLimits(est: { plan_tier?: string | null } | null | undefined): PlanLimits {
  return PLANS[normalizePlanTier(est?.plan_tier)];
}

export type PlanFeature =
  | 'qrOrdering'
  | 'kitchen'
  | 'multiSite'
  | 'ocrAi'
  | 'advancedReports'
  | 'prioritySupport';

/** Pendant l’essai gratuit : accès Pro pour convaincre, puis retour au plan choisi */
export function getEffectivePlan(
  est: { plan_tier?: string | null; subscription_status?: string | null } | null | undefined,
): PlanLimits {
  const status = String(est?.subscription_status || 'trial');
  if (status === 'trial') return PLANS.pro;
  return getPlanLimits(est);
}

export function canUseFeature(
  est: { plan_tier?: string | null; subscription_status?: string | null } | null | undefined,
  feature: PlanFeature,
): boolean {
  return Boolean(getEffectivePlan(est)[feature]);
}

export function upgradeMessage(featureLabel: string): string {
  return `${featureLabel} est réservé au plan Pro. Passez en Pro (${PLANS.pro.monthlyFcfa.toLocaleString('fr-FR')} F/mois) via WhatsApp pour débloquer.`;
}

/** Durées d’abonnement proposées (mois) */
export const SUB_PERIODS = [
  { months: 1, label: '1 mois' },
  { months: 3, label: '3 mois' },
  { months: 6, label: '6 mois' },
  { months: 12, label: '1 an' },
  { months: 24, label: '2 ans' },
  { months: 60, label: '5 ans' },
] as const;

const WA_STORAGE = 'mm_payment_whatsapp';

/** Numéro WhatsApp admin pour les paiements (E.164 sans + ou avec) */
export function getPaymentWhatsApp(): string {
  try {
    const v = localStorage.getItem(WA_STORAGE);
    if (v && v.replace(/\D/g, '').length >= 8) return v;
  } catch {
    /* */
  }
  return '2250502012011';
}

export function setPaymentWhatsApp(phone: string) {
  localStorage.setItem(WA_STORAGE, phone.trim());
}

export function paymentWhatsAppLink(message?: string): string {
  let d = getPaymentWhatsApp().replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  // 0502012011 → 2250502012011 (garder le 0 local après 225)
  if (d.startsWith('0') && d.length === 10) d = '225' + d;
  else if (!d.startsWith('225') && d.length === 10) d = '225' + d;
  // Format demandé : https://wa.me/+2250502012011
  const withPlus = d.startsWith('+') ? d : `+${d}`;
  const text =
    message ||
    `Bonjour, je souhaite payer mon abonnement GESMAK (${PLAN.monthlyFcfa.toLocaleString('fr-FR')} F/mois). Mon établissement : `;
  return `https://wa.me/${withPlus}?text=${encodeURIComponent(text)}`;
}

export function priceForMonths(months: number, tier?: PlanTier): number {
  const m = Math.max(1, Math.floor(months));
  if (tier && PLANS[tier]) return PLANS[tier].monthlyFcfa * m;
  return PLAN.monthlyFcfa * m;
}

/** Montant abonnement selon plan + durée */
export function priceForPlanMonths(tier: PlanTier, months: number): number {
  return priceForMonths(months, tier);
}

export function addMonthsISO(from: Date, months: number): string {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'suspended';

export type EstSubscription = {
  id?: string;
  name?: string;
  subscription_status?: string | null;
  trial_ends_at?: string | null;
  subscription_ends_at?: string | null;
  last_payment_at?: string | null;
  plan_tier?: string | null;
};

export function trialEndsAtFromNow(days = PLAN.trialDays): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export function getSubscriptionState(est: EstSubscription | null | undefined): {
  status: SubscriptionStatus;
  blocked: boolean;
  label: string;
  daysLeft: number | null;
  message: string;
} {
  if (!est) {
    return { status: 'trial', blocked: false, label: '—', daysLeft: null, message: '' };
  }

  const status = (est.subscription_status || 'trial') as SubscriptionStatus;
  const now = Date.now();

  if (status === 'suspended') {
    return {
      status: 'suspended',
      blocked: true,
      label: 'Suspendu',
      daysLeft: 0,
      message: `Abonnement impayé (${PLAN.monthlyFcfa.toLocaleString('fr-FR')} ${PLAN.currencyLabel}/mois). Contactez-nous sur WhatsApp pour payer.`,
    };
  }

  if (status === 'active') {
    const end = est.subscription_ends_at ? new Date(est.subscription_ends_at).getTime() : null;
    if (end && end < now) {
      const graceEnd = end + PLAN.graceDays * 86400000;
      if (now <= graceEnd) {
        return {
          status: 'past_due',
          blocked: false,
          label: 'En retard',
          daysLeft: Math.max(0, Math.ceil((graceEnd - now) / 86400000)),
          message: `Paiement en retard. Régularisez sous ${PLAN.graceDays} jours via WhatsApp.`,
        };
      }
      return {
        status: 'suspended',
        blocked: true,
        label: 'Suspendu',
        daysLeft: 0,
        message: `Accès suspendu. Abonnement ${PLAN.monthlyFcfa.toLocaleString('fr-FR')} F/mois — payez via WhatsApp.`,
      };
    }
    const daysLeft = end ? Math.max(0, Math.ceil((end - now) / 86400000)) : null;
    return {
      status: 'active',
      blocked: false,
      label: `Actif · ${getPlanLimits(est).label}`,
      daysLeft,
      message:
        daysLeft != null
          ? `Abonnement actif jusqu’au ${est.subscription_ends_at ? new Date(est.subscription_ends_at).toLocaleDateString('fr-FR') : '—'} (${daysLeft} j)`
          : 'Abonnement actif',
    };
  }

  const trialEnd = est.trial_ends_at ? new Date(est.trial_ends_at).getTime() : null;
  if (status === 'trial' || !est.subscription_status) {
    if (trialEnd && trialEnd < now) {
      const graceEnd = trialEnd + PLAN.graceDays * 86400000;
      if (now <= graceEnd) {
        return {
          status: 'past_due',
          blocked: false,
          label: 'Essai terminé',
          daysLeft: Math.max(0, Math.ceil((graceEnd - now) / 86400000)),
          message: `Essai d'1 mois terminé. Payez via WhatsApp (${PLAN.monthlyFcfa.toLocaleString('fr-FR')} F/mois).`,
        };
      }
      return {
        status: 'suspended',
        blocked: true,
        label: 'Suspendu',
        daysLeft: 0,
        message: `Essai terminé. Contactez WhatsApp pour activer l'abonnement (${PLAN.monthlyFcfa.toLocaleString('fr-FR')} F/mois).`,
      };
    }
    const daysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd - now) / 86400000)) : PLAN.trialDays;
    const afterTrial = PLANS.starter;
    return {
      status: 'trial',
      blocked: false,
      label: 'Essai Pro',
      daysLeft,
      message: `Essai Pro — ${daysLeft} j restant${daysLeft === 1 ? '' : 's'}. Ensuite forfait Essentiel à ${afterTrial.monthlyFcfa.toLocaleString('fr-FR')} F/mois (ou Pro à ${PLANS.pro.monthlyFcfa.toLocaleString('fr-FR')} F/mois).`,
    };
  }

  if (status === 'past_due') {
    return {
      status: 'past_due',
      blocked: false,
      label: 'Paiement requis',
      daysLeft: PLAN.graceDays,
      message: `Régularisez via WhatsApp : ${PLAN.monthlyFcfa.toLocaleString('fr-FR')} F/mois.`,
    };
  }

  return { status: 'trial', blocked: false, label: 'Essai', daysLeft: null, message: '' };
}


/** Pluriel FR simple pour compteurs */
export function formatUnit(n: number, singular: string, plural?: string): string {
  const p = plural || singular + 's';
  return `${n} ${n <= 1 ? singular : p}`;
}

export function isOnTrial(
  est: { subscription_status?: string | null } | null | undefined,
): boolean {
  const s = String(est?.subscription_status || 'trial');
  return s === 'trial' || !est?.subscription_status;
}

/** Titre affiché cohérent (essai vs forfait payant) */
export function getPlanDisplayTitle(
  est: { plan_tier?: string | null; subscription_status?: string | null } | null | undefined,
): string {
  if (!est) return '—';
  if (isOnTrial(est)) return 'Essai Pro';
  return getEffectivePlan(est).label;
}

/** Limites réellement actives (Pro pendant essai) */
export function getActivePlanLimits(
  est: { plan_tier?: string | null; subscription_status?: string | null } | null | undefined,
): PlanLimits {
  return getEffectivePlan(est);
}

export function formatPlanLimitsLine(limits: PlanLimits): string {
  return [
    formatUnit(limits.maxEstablishments, 'site'),
    formatUnit(limits.maxEmployees, 'employé'),
    formatUnit(limits.maxProducts, 'produit') + ' max',
  ].join(' · ');
}

export function paymentInstructions(): string {
  return (
    `Offre GESMAK\n` +
    `• Mise en place stock : ${PLAN.setupStockFcfa.toLocaleString('fr-FR')} F\n` +
    `• 1 mois d'essai Pro gratuit\n` +
    `• Après essai : Essentiel ${PLANS.starter.monthlyFcfa.toLocaleString('fr-FR')} F/mois` +
    ` · Pro ${PLANS.pro.monthlyFcfa.toLocaleString('fr-FR')} F/mois` +
    ` · Business ${PLANS.business.monthlyFcfa.toLocaleString('fr-FR')} F/mois\n` +
    `• Durées : 1, 3, 6 mois, 1 an, 2 ans, 5 ans\n` +
    `Paiement : Wave 05 02 01 20 11 puis WhatsApp pour confirmer (activation manuelle)`
  );
}
