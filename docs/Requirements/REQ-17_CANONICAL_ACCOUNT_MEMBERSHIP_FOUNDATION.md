# REQ-17 — Canonical Account, Tenant Membership & Store Access Foundation

**Status:** Implemented — database validation pending  
**Owner:** Project owner  
**Scope:** KONEKT multi-tenant / multi-store refactor, Phase 1 only

## Context and objective

The current application represents a user's Tenant and Store relationship directly on `users`, while older modules also use `role_id` and `user_stores`. This prevents one global Account from safely representing different roles and Store access across multiple Tenants.

This phase introduces an additive canonical data model without changing runtime authentication, registration, frontend flows, operational authorization, or HR/payroll behavior.

## User stories

- As a future KONEKT Account holder, I need one account to be representable in multiple Tenants with a distinct role per Tenant.
- As a Tenant owner, I need future Store access to be expressible as either all Stores or selected Stores.
- As a developer, I need deterministic audit/backfill tooling that does not guess when duplicate legacy identities conflict.

## In scope

- Add canonical membership, Store access, permissions, membership override, Tenant join request, and employment-profile schema.
- Add `tenants.join_code` and `tenants.created_by` additively.
- Add RLS and revoke direct `anon`/`authenticated` access for the new backend-only tables, consistent with the current KONEKT tables.
- Provide a read-only duplicate-identity audit and an explicit, conservative backfill path.
- Add focused database fixture tests for schema invariants.

## Out of scope

- Login, registration, JWT, workspace selector, Tenant switcher, Store switcher, onboarding endpoints, and frontend changes.
- Permission middleware, role-guard replacement, POS/inventory authorization, and business-table redesign.
- HR, attendance, payroll, or legacy runtime migration.
- Deleting or renaming legacy fields/tables, merging or deleting duplicate User rows, and global email uniqueness enforcement.
- Tenant invitation expiry, single-use tokens, or a tenant-join-code table.

## Acceptance criteria

- [x] New canonical tables and enums are additive and represented in the Drizzle schema.
- [x] `tenant_memberships` permits one Account in many Tenants but prevents a duplicate `(tenant_id, user_id)` membership.
- [x] `membership_store_access` prevents duplicate membership/Store pairs and uses composite foreign keys to prevent cross-Tenant links on access-row and parent-Tenant updates.
- [x] Owner-style `ALL` Store scope is modelled without per-Store access rows; selected access supports multiple Stores.
- [x] Role permission existence denotes allow; individual membership override supports only `allow` and `deny`.
- [x] `tenant_join_requests` has pending-per-Account/Tenant partial uniqueness and supports requests in different Tenants.
- [x] Exactly one `employment_profile` may belong to a membership.
- [x] Audit/backfill handles valid singleton Accounts and verified compatible duplicate identities. Duplicate auto-grouping requires a non-empty identical stored password hash for every row; hash differences are manual-review conflicts, not proof of different people.
- [x] Legacy `users.role` and `role_id -> roles.name` are reconciled conservatively; conflicting or unsupported sources are reported and skipped.
- [x] Legacy `user_stores` audit reports orphan, missing Store, cross-Tenant, duplicate, and unsupported assignments instead of silently dropping them.
- [x] Existing canonical membership state is compared during backfill; mismatches are reported and never silently mutated.
- [x] Tenant join-request state constraints define pending, approved, rejected, and applicant-cancelled states without permitting OWNER assignment.
- [x] Existing legacy schema and current auth/UI/runtime behavior are unchanged by this Phase 1 implementation.
- [ ] PostgreSQL migration replay, catalog validation, focused fixture/audit/backfill execution remain pending. A local PostgreSQL service exists but is not project-configured or identified as disposable; the configured remote Supabase pooler is not named or confirmed as non-production.
