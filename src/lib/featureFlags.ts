/**
 * GESMAK Phase 3B — feature flags (transition safety).
 * New multi-service / multi-caisse paths stay OFF until explicitly enabled.
 * Prefer env override for preview; default false preserves current maquis flows.
 */

function envFlag(name: string, fallback = false): boolean {
  try {
    const v = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.[name];
    if (v === undefined || v === '') return fallback;
    return v === '1' || v.toLowerCase() === 'true' || v === 'yes';
  } catch {
    return fallback;
  }
}

export const featureFlags = {
  /** Schema + UI for services / cash registers / assignments */
  multiServices: envFlag('VITE_FF_MULTI_SERVICES', false),
  /** Require cash_session_id on new sales (only when multiServices on) */
  requireCashSessionOnSale: envFlag('VITE_FF_REQUIRE_CASH_SESSION', false),
  /** Enforce one open session per register / cashier in UI */
  strictSessionUniqueness: envFlag('VITE_FF_STRICT_SESSION', false),
  /** Show approval_requests UI */
  approvalRequests: envFlag('VITE_FF_APPROVAL_REQUESTS', false),
} as const;

export type FeatureFlagName = keyof typeof featureFlags;

export function isFeatureEnabled(name: FeatureFlagName): boolean {
  return Boolean(featureFlags[name]);
}
