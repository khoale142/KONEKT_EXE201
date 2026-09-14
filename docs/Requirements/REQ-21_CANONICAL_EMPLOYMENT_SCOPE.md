# REQ-21 — Canonical Employment Scope

**Status:** Implemented

Employment identity is scoped to `tenant_memberships`: one Account may have distinct employment data for each Tenant membership. Canonical HR APIs resolve Account → active membership → Tenant and preserve Store scope through Phase 4 authorization.

## Scope

- Read/update `employment_profiles` only through an owned canonical membership.
- Canonical HR profile endpoints and workforce lookup use membership identity.
- Legacy User employment fields remain a compatibility fallback outside migrated endpoints.

## Excluded

No legacy-field deletion, HR/payroll table rewrite, destructive operation, or Phase 6 work.
