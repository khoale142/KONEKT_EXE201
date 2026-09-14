# PLAN-17 — Canonical Account, Tenant Membership & Store Access Foundation

**Requirement:** [REQ-17](../../Requirements/REQ-17_CANONICAL_ACCOUNT_MEMBERSHIP_FOUNDATION.md)  
**Status:** Implemented — remote database validation pending  
**Scope:** Phase 1 only

## Goal

Introduce an additive canonical Account → TenantMembership → StoreAccess model. The new schema and migration tooling must coexist with every legacy identity, onboarding, authorization, and HR path currently in use.

## Files to create

- `[NEW]` `backend/drizzle/0002_canonical_membership_foundation.sql`
- `[NEW]` `backend/src/scripts/audit_canonical_memberships.ts`
- `[NEW]` `backend/src/scripts/backfill_canonical_memberships.ts`
- `[NEW]` `backend/src/scripts/test_canonical_memberships.ts`
- `[NEW]` `docs/Requirements/REQ-17_CANONICAL_ACCOUNT_MEMBERSHIP_FOUNDATION.md`
- `[NEW]` `docs/Developing/plans/PLAN-17_CANONICAL_ACCOUNT_MEMBERSHIP_FOUNDATION.md`

## Files to modify

- `[MODIFY]` `backend/src/db/schema.ts`
- `[MODIFY]` `backend/drizzle/meta/_journal.json`
- `[MODIFY]` `backend/drizzle/meta/0002_snapshot.json`
- `[MODIFY]` `backend/package.json` — only add scripts for the new audit, backfill, and test utilities.
- `[MODIFY]` `docs/Requirements/README.md`
- `[MODIFY]` `docs/Developing/plans/README.md`
- `[MODIFY]` `docs/Developing/logs/DEV_CHANGELOG.md` — only after implementation is complete.

## Files explicitly not changed

- Authentication, JWT, workspace services/routes, middleware, and all frontend files.
- POS, inventory, KDS, orders, attendance, payroll, HR, and legacy raw-SQL modules.
- `users.tenant_id`, `users.store_id`, `users.role`, `users.custom_permissions`, `role_id`, `user_stores`, `stores.invite_code`, `store_join_requests`, legacy role tables, and legacy authentication code.
- Existing dirty worktree files, especially `backend/drizzle/0001_staff_onboarding_integrity.sql` and its snapshot, except that the generated Phase 1 migration must be sequenced after them.

## Implementation steps

1. Reconcile the current Drizzle schema, migration journal, legacy SQL assumptions, and the repository's read-only Supabase audit. Do not apply any migration until the preflight report identifies the live schema/version.
2. Add canonical enums: membership role (`owner`, `manager`, `leader`, `staff`), membership status, Store access scope (`all`, `selected`), override effect (`allow`, `deny`), and Tenant join-request status.
3. Extend `tenants` additively with nullable `join_code` and nullable `created_by` referencing `users`. Add a unique non-null join-code index; existing Tenant creation remains untouched, so Phase 1 does not require every existing Tenant to have a code.
4. Define the seven canonical tables in Drizzle: `tenant_memberships`, `membership_store_access`, `permissions`, `role_permissions`, `membership_permission_overrides`, `tenant_join_requests`, and `employment_profiles`.
5. Add PK/FK/unique/check constraints and indexes for every FK and intended lookup. Enforce cross-Tenant Store access with `membership_store_access.tenant_id` plus composite foreign keys to `(tenant_memberships.id, tenant_id)` and `(stores.id, tenant_id)`; do not rely on an application check or trigger.
6. Generate/review an additive Drizzle migration after the pre-existing `0001` migration. It must enable RLS and revoke `anon`/`authenticated` table grants for the new backend-only tables, matching the project's current backend-only KONEKT data access. No RLS policy is added because the app does not use Supabase Auth identities or direct Data API access for these tables.
7. Implement `audit_canonical_memberships.ts` as a read-only report. It groups normalized emails, includes eligible singleton Accounts and compatible duplicate groups, reconciles `users.role` with `role_id -> roles.name`, and reports role conflicts plus orphan/missing/cross-Tenant/duplicate `user_stores` assignments.
8. Implement `backfill_canonical_memberships.ts` as an explicit opt-in utility. It uses a transaction, selects the lowest existing `users.id` as canonical for an eligible group, creates membership/access/profile rows idempotently, compares any existing canonical membership before continuing, never deletes or updates legacy identity/role fields, and emits a report for every skipped conflict.
9. Add database fixture tests using a unique prefix and explicit cleanup manifest, following the existing onboarding test-script convention. Test all Phase 1 schema invariants, including cross-Tenant Store access rejection and pending-request partial uniqueness.
10. Run migration validation against a disposable/local development database where available, the focused fixture test, `npm run build`, and configured lint. Record only Phase 1-related results in the changelog and mark Requirement/Plan checklists after successful verification.

## Backfill rules

- Normalize email with `lower(trim(email))`.
- A singleton with a normalized email and non-empty password hash is an eligible Account group. A duplicate group is eligible only when every candidate has the same non-empty normalized email, the same stored password hash, and no conflicting identity fields that the audit classifies as severe. Different bcrypt hashes require manual review; they do not prove different people.
- The lowest numeric `users.id` is canonical for an eligible group. Other legacy User rows remain untouched.
- Map only `owner → owner`, `store_manager → manager`, `shift_leader → leader`, and `staff → staff`.
- Owners receive `all` Store scope and no access rows. Other mapped roles receive `selected`; valid legacy `store_id` and `user_stores` assignments become access rows after Tenant ownership validation.
- No custom permission conversion occurs unless a legacy value exactly maps to a canonical permission key and a defined allow/deny semantic. Phase 1 defaults to reporting this gap.
- An employment profile is copied only when one legacy row maps unambiguously to one canonical membership.
- Join-request states are minimal and DB-enforced: pending/cancelled are unreviewed without a role; approved requires reviewer, timestamp, and non-OWNER role; rejected requires reviewer and timestamp without a role.

## Risks and rollback

| Risk | Mitigation / rollback |
|---|---|
| Drizzle history and live Supabase schema diverge | Run read-only preflight first; do not apply. Pull/reconcile history separately if needed. |
| Existing uncommitted `0001` migration/schema changes | Treat them as a dependency; do not rewrite them. Add a new sequential migration only. |
| Bad duplicate-identity merge | Backfill is opt-in, transactional, idempotent, and skips uncertain groups. Phase 1 never deletes Users. |
| Cross-Tenant access data corruption | Enforce matching Tenant ownership with composite foreign keys and fixture-test access and parent-Tenant mutation rejection. |
| RLS blocks backend unexpectedly | Tables remain accessed through the trusted server connection; fixture test verifies RLS/grants and application behavior is otherwise untouched. |

## Verification plan

- `npm run db:generate` and inspect the generated migration/snapshot for additive DDL only.
- Run live/dev preflight audit without printing credentials or PII.
- Run focused canonical-membership fixture tests; fixtures must be clearly prefixed and cleaned only by verified IDs.
- Run `npm run build` in `backend`.
- Run lint only if a configured command exists.
- Confirm `git diff --check` and confirm no Phase 2+ files changed.

## Implementation result

- The generated full-schema diff was deliberately discarded after review because it attempted to replay unrelated historical tables and columns. Revised custom `0002` contains only final Phase 1 DDL; its snapshot now represents the post-0002 Drizzle schema and a follow-up generation reports no schema changes.
- Typecheck and backend build pass after the review fixes. PostgreSQL migration replay, catalog validation, audit/backfill and fixtures remain pending until an identified disposable/development database is available. A local PostgreSQL service is present but is not project-configured or identified as disposable; the configured Supabase pooler is not confirmed as non-production.
