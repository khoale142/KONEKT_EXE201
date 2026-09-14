# REQ-20 — Canonical Store Access and Permissions

**Status:** Implemented

Canonical authorization resolves the logged-in Account's active membership from the database. Store access comes from `all` scope or `membership_store_access`; effective permissions are membership overrides first, then `role_permissions`.

## Scope

- Central `requireStoreAccess`, `requirePermission`, and effective-permission resolution.
- Workspace/Tenant, Store, staff, and selected POS entry points use canonical guards when the JWT is canonical.
- Frontend receives effective permissions for UX only.

## Excluded

Phase 5 employment/HR, legacy deletion, and a whole-repository authorization rewrite.
