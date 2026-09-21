/**
 * Prix officiels côté serveur — source de vérité
 * Le frontend affiche, le serveur valide.
 */
export const SERVER_PLAN_PRICES = {
  starter: { setup: 12_500, monthly: 6_000 },
  pro: { setup: 25_000, monthly: 12_000 },
  business: { setup: 55_000, monthly: 25_000 },
} as const;

export const SERVER_PERIOD_MULTIPLIERS: Record<number, number> = {
  1: 1,
  3: 2.85,
  6: 5.4,
  12: 10,
};

export function expectedAmountForMonths(monthly: number, months: number): number {
  const mult = SERVER_PERIOD_MULTIPLIERS[months] ?? months;
  return Math.round(monthly * mult);
}
