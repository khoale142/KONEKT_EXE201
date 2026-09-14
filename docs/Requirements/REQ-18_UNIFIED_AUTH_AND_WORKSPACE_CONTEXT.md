# REQ-18 — Unified Authentication & Workspace Context

**Status:** Complete — development canonical rollout verified  
**Prerequisite:** REQ-17 / PLAN-17 canonical Account → TenantMembership → StoreAccess foundation

## Context and objective

Phase 1 added the canonical membership data model, but KONEKT runtime authentication still derives Tenant, Store, and role from legacy `users` columns. Phase 2 makes Account → TenantMembership → StoreAccess authoritative for the new KONEKT auth/session flow while retaining explicitly isolated legacy compatibility.

The active context is `{ accountId, tenantId, membershipId, storeId? }`. Login authenticates an Account once; every workspace action must prove that the selected membership belongs to that Account.

## User stories

- As a multi-Tenant Account holder, I sign in once, see only my active memberships, and switch Tenant without another login.
- As a single-Tenant Account holder, I retain a usable login path during rollout.
- As a Tenant operator, I cannot access another Account's membership, Tenant, or Store by forging request/token values.

## In scope

- Canonical KONEKT Account login, refresh, and `/auth/me` session response.
- Membership-based Tenant listing, activation/switching, and optional Store selection constrained by StoreAccess.
- Backend anti-spoofing checks and frontend hydration, redirects, selector, and switcher updates.
- A read-only DB preflight; apply the existing additive 0002 only through the normal runner when the target is positively identified as the permitted development DB and required by Phase 2.

## Out of scope

- Phase 3 Tenant create/join redesign; backfill automation; HR/payroll; POS/business redesign; full permission engine.
- Removal of legacy `users.tenant_id`, `users.store_id`, `users.role`, `role_id`, `user_stores`, or any table.
- New/edit migrations, `schema.ts`, destructive fixtures, reset/drop operations, or writes to an unconfirmed/main database.

## Acceptance criteria

- [x] Canonical login/session returns `accountId`, `tenantId`, `membershipId`, and optional `storeId`.
- [x] Canonical `/auth/me` and refresh re-resolve context from database rather than legacy Tenant/Store/role fields.
- [x] Canonical workspace listing exposes only active memberships of the authenticated Account.
- [x] Tenant activation rejects membership/Tenant spoofing and Store activation rejects access outside `ALL` or explicit `SELECTED` scope.
- [x] Frontend hydrates/replaces canonical context and routes users through Tenant/Store choice as needed.
- [x] A single-Tenant legacy KONEKT user remains login-compatible during canonical rollout.
- [x] Focused unit authorization/session checks plus backend/frontend type-check and build pass.
- [x] The user-approved development database has migration `0002`, canonical audit/backfill, idempotency, canonical-row integrity verification, and focused build/test verification completed. Identity conflicts remain intentionally unmigrated rather than being auto-merged.
