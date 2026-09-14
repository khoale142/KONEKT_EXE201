# PLAN-20 — Canonical Authorization

**Requirement:** [REQ-20](../../Requirements/REQ-20_CANONICAL_STORE_ACCESS_AND_PERMISSIONS.md)  
**Status:** Approved and implemented

1. Resolve canonical Account/Membership/Tenant/Store/override state in one centralized service.
2. Add composable Express guards; preserve legacy behavior when no canonical JWT exists.
3. Re-resolve effective permissions during canonical session issuance and hydrate the frontend session.
4. Cover workspace lifecycle, Store management, staff management, and existing Store/POS guarded paths without rewriting unrelated modules.
