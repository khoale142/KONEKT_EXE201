# PLAN-21 — Membership-scoped Employment

**Requirement:** [REQ-21](../../Requirements/REQ-21_CANONICAL_EMPLOYMENT_SCOPE.md)  
**Status:** Approved and implemented

1. Resolve employment profiles through canonical authorization, never a client-supplied Account/Tenant pair.
2. Provide self and member-management endpoints guarded by `member.manage` and selected Store scope where requested.
3. Keep non-migrated attendance/payroll legacy flows compatible; canonical consumers receive membership IDs.
