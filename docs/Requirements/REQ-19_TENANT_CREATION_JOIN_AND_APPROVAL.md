# REQ-19 — Tenant Creation, Join and Membership Approval

**Status:** Implemented  
**Prerequisite:** REQ-17 canonical tables; REQ-18 canonical session/workspace context

## Objective

Make Tenant creation and joining use the canonical Account → TenantMembership model.

## Scope

- An authenticated Account creates a Tenant, first Store, reusable join code, and its active `owner` membership with `all` Store scope in one transaction.
- An Account submits one pending `tenant_join_request` per Tenant by join code; applicant role is never client-controlled.
- A canonical Owner lists, approves, rejects, or an applicant cancels requests. Approval permits only `staff`, `leader`, or `manager`, validates selected same-Tenant Stores, and atomically creates/activates membership plus Store access.
- Frontend exposes create, join-code submission, pending state, and Owner review actions.

## Out of scope

- Phase 4 permission engine, HR/payroll migration, legacy removal, destructive operations, and automatic merge of conflicting audit identities.

## Acceptance criteria

- [x] Creation records `created_by` only as an audit actor and derives authority from `tenant_memberships`.
- [x] Join and approval reject cross-account, cross-Tenant, duplicate-pending, and owner-role escalation attempts.
- [x] Canonical workspace refresh resolves approved memberships through the existing `/workspace/tenants` resolver.
- [x] Backend/frontend builds pass.
