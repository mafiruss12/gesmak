import { useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import {
  canUseFeature,
  getEffectivePlan,
  getPlanLimits,
  upgradeMessage,
  type PlanFeature,
  type PlanLimits,
} from '@/lib/subscription';

export function usePlanAccess() {
  const { activeEstablishment } = useAuth();
  const est = activeEstablishment as { plan_tier?: string | null; subscription_status?: string | null } | null;

  const plan: PlanLimits = useMemo(() => getEffectivePlan(est), [est?.plan_tier, est?.subscription_status]);
  const storedPlan = useMemo(() => getPlanLimits(est), [est?.plan_tier]);

  function allow(feature: PlanFeature): boolean {
    return canUseFeature(est, feature);
  }

  function assertFeature(feature: PlanFeature, label: string): boolean {
    if (allow(feature)) return true;
    alert(upgradeMessage(label));
    return false;
  }

  function assertEmployeeLimit(currentCount: number): boolean {
    if (currentCount < plan.maxEmployees) return true;
    alert(
      `Plan ${storedPlan.label} : maximum ${plan.maxEmployees} employés. Passez en Pro pour en ajouter plus.`,
    );
    return false;
  }

  function assertProductLimit(currentCount: number): boolean {
    if (currentCount < plan.maxProducts) return true;
    alert(
      `Plan ${storedPlan.label} : maximum ${plan.maxProducts} produits. Passez en Pro pour élargir le catalogue.`,
    );
    return false;
  }

  return {
    plan,
    storedPlan,
    allow,
    assertFeature,
    assertEmployeeLimit,
    assertProductLimit,
    isTrialPro: String(est?.subscription_status || 'trial') === 'trial',
  };
}
