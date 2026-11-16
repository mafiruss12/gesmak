# GESMAK Phase 3B — Multi-services / multi-caisses

**Branch:** `feature/gesmak-multi-services`  
**Base commit:** `a9f08fd`  
**Status:** schema additive prepared — **not applied to production**

## 3A.2 summary

- `cash_sessions` RLS isolates by `members.establishment_id` (no cross-est leak via that policy alone).
- `operation_audit`: RLS blocks UPDATE/DELETE for normal roles; REVOKE of table grants deferred until owner validates (prod).
- `sales.cash_session_id` / `orders.cash_session_id` missing in live until this migration is applied.
- Multiple `open` sessions per establishment observed — partial unique indexes added when `cash_register_id` / `opened_by` set.

## Migration

File: `supabase/migrations/20261116_multi_services_caisses_v1.sql`

Additive only:

- `services`, `cash_registers`, `service_assignments`, `cash_register_assignments`, `approval_requests`
- nullable extensions on `cash_sessions`, `sales`, `orders`
- technical default service + register (`assignment_kind = technical_compat`)
- no DROP, no historical session invention

## Production rules

- Do **not** run this migration on production without explicit owner approval.
- Do **not** deploy this branch to production until UI flags and regression tests pass.
- Feature flags recommended before enforcing single open session / mandatory `cash_session_id`.

## Next lot

1. App types + optional `cash_session_id` on new sales only  
2. Offline: immutable origin session + `client_op_id`  
3. UI services/caisses (behind flag)  
4. Harden `cash_sessions_member_all` after dual-path tests  
