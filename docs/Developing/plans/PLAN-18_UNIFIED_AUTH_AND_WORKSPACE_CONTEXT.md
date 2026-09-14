# PLAN-18 — Unified Authentication & Workspace Context

**Requirement:** [REQ-18](../../Requirements/REQ-18_UNIFIED_AUTH_AND_WORKSPACE_CONTEXT.md)  
**Status:** Complete — development canonical rollout verified  
**Scope:** KONEKT Phase 2 only

## Goal

Make the new KONEKT runtime path use canonical Account → active TenantMembership → StoreAccess context, while preserving legacy flows and excluding Phase 3, HR/payroll, POS/business modules, and the permission engine.

## Files to create

- `[NEW]` `backend/src/modules/auth/canonicalWorkspaceSession.service.ts`
- `[NEW]` `backend/src/scripts/test_canonical_workspace_session.ts`
- `[NEW]` `docs/Requirements/REQ-18_UNIFIED_AUTH_AND_WORKSPACE_CONTEXT.md`
- `[NEW]` `docs/Developing/plans/PLAN-18_UNIFIED_AUTH_AND_WORKSPACE_CONTEXT.md`

## Files to modify

- `[MODIFY]` `backend/src/modules/auth/konektAuth.service.ts`, `konektSession.service.ts`, `auth.controller.ts`, `auth.routes.ts`
- `[MODIFY]` `backend/package.json`
- `[MODIFY]` `backend/src/middlewares/authGuard.ts`, `backend/src/utils/jwt.ts`
- `[MODIFY]` `backend/src/modules/workspace/workspace.controller.ts`, `workspace.routes.ts`, `workspace.schema.ts`
- `[MODIFY]` `frontend/src/app/store/auth.store.ts`, `frontend/src/lib/http/axios.ts`
- `[MODIFY]` `frontend/src/features/workspace/api/workspace.api.ts`, `pages/SelectTenantPage.tsx`, `pages/SelectStorePage.tsx`
- `[MODIFY]` `frontend/src/features/auth/pages/MerchantLoginPage.tsx`
- `[MODIFY]` `frontend/src/shared/components/WorkspaceSwitcher.tsx`
- `[MODIFY]` requirements/plans indexes and `DEV_CHANGELOG.md`

## Files explicitly not changed

- `backend/src/db/schema.ts`, Drizzle 0000/0001/0002, all Drizzle metadata, and environment files.
- HR/onboarding approval, payroll, attendance, invite/join redesign, POS/orders/KDS/inventory, permission middleware/engine, legacy fields and tables.

## Steps

1. **Safety gate:** inspect configured DB read-only. Use temporary `DATABASE_URL` with `npm run db:migrate` only when target identity is positively confirmed as permitted development DB and canonical tables are absent. Never reset/drop/backfill or write to unconfirmed/main DB.
2. **Canonical resolver:** load active Account, active membership, Tenant, and Store scope; reject inactive/suspended entities and any membership/Tenant/Store mismatch.
3. **Session authority:** extend KONEKT-only token claims with `accountId`/`membershipId`; canonical login, refresh, `/auth/me`, and guard re-resolve DB context. Keep customer and legacy token contracts intact.
4. **Workspace APIs:** list and activate canonical memberships; server derives membership under `claims.accountId`, validates Tenant, then permits Store only for `ALL` or explicit same-Tenant access.
5. **Frontend:** add canonical context/membership types, replace stale stored scope during hydrate, update Tenant/Store selection and switcher to use the canonical activation response atomically.
6. **Compatibility:** retain the existing resolver as a distinct single-Tenant fallback only when no canonical membership exists; canonical state wins whenever present.
7. **Verify:** focused multi-Tenant switch/negative spoofing/Store-scope/refresh-me/fallback tests; backend/frontend type-check/build; non-writing Drizzle drift check. No generated migration is retained.

## Risks and rollback

- Missing canonical tables or migration error: stop and return exact DB error; do not edit SQL.
- Stale context: DB re-resolution on guard, refresh, and `/auth/me`; frontend replaces, not merges, context.
- Cross-tenant escalation: derive membership from authenticated Account and validate Store scope server-side.
- Legacy regression: leave legacy endpoints/resolver untouched outside explicit fallback routing.

## Stop & wait

Completed on 13/09/2026. The user approved the configured database as development; the normal runner applied existing migration `0002`, the conservative canonical backfill was run twice, and focused canonical/build checks passed. No fixture or Phase 3 action was run.
