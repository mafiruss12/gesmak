# GESMAK Phase 3B — Multi-services / multi-caisses

**Branch:** `feature/gesmak-multi-services`  
**Base commit:** `a9f08fd` (also current `main` tip at branch creation)  
**Status:** first implementation lot on branch — **not applied to production**

## Files (lot 1)

| Path | Role |
|------|------|
| `supabase/migrations/20261116_multi_services_caisses_v1.sql` | Additive schema |
| `docs/PHASE_3B.md` | This document |
| `src/lib/types.ts` | `cash_session_id?` + 3B entity types |
| `src/lib/featureFlags.ts` | Transition flags (default **off**) |
| `scripts/validate-3b-migration.mjs` | Static migration safety checks |

## Feature flags (default off)

| Flag env | Purpose |
|----------|---------|
| `VITE_FF_MULTI_SERVICES` | Enable multi-service UI/paths |
| `VITE_FF_REQUIRE_CASH_SESSION` | Require session on new sales |
| `VITE_FF_STRICT_SESSION` | UI enforce one open session |
| `VITE_FF_APPROVAL_REQUESTS` | Approval UI |

Until flags are on, existing maquis/caisse/QR flows stay unchanged.

## Schema (additive)

- **New:** `services`, `cash_registers`, `service_assignments`, `cash_register_assignments`, `approval_requests`
- **Extend (nullable):** `cash_sessions.cash_register_id`, `cash_sessions.service_id`, `sales.cash_session_id`, `orders.cash_session_id`
- **Backfill:** default service + register per establishment with `assignment_kind = technical_compat` only
- **Constraints:** partial unique open session per register; per opener+establishment
- **RLS:** new tables only; existing `cash_sessions_member_all` **not** replaced in this lot

## Production limits

- Do **not** run migration on production without explicit owner approval
- Do **not** deploy this branch to production until flags + regression pass
- No DROP / DELETE of business data in this migration

## Validate locally

```bash
node scripts/validate-3b-migration.mjs
```

## Next lots

1. Wire new sales to `cash_session_id` when flag on  
2. Offline: immutable origin session + `client_op_id`  
3. UI services/caisses behind `multiServices`  
4. Optional harden of `cash_sessions` policies after dual-path tests  


## Lot 3B.2 — Ventes ↔ sessions (implémenté sur branche)

- `src/lib/saleSession.ts` : résolution session + `client_op_id` ; blocage si `VITE_FF_REQUIRE_CASH_SESSION`
- `src/pages/Caisse.tsx` : rattache `cash_session_id` ; **en ligne** stock décrémenté **uniquement** par le trigger SQL
- `src/lib/offline.ts` : conserve la session d'origine à la sync
- Flags restent **off** par défaut
- QR : inchangé (commande ≠ vente automatique)
