# REQ-23 — Canonical Account Onboarding Integration

**Status:** Implemented and verified

## Goal

Break the circular onboarding dependency by allowing one global KONEKT Account to hold an authenticated, canonical account-only session before it has any TenantMembership.

## Scope

- Add canonical `scope: account` claims with Account identity only.
- Register a global Account without Tenant/Store/role authority.
- Let account scope list workspace state, create a Tenant, submit/cancel a canonical Tenant join request, refresh, and hydrate `/auth/me`.
- Route the primary registration experience and Workspace Hub through canonical create/join actions; distinguish `KON-...` Tenant codes from legacy `STR-...` Store codes.
- Show Owners their canonical Tenant join code and canonical request-review navigation.

## Acceptance criteria

- [x] Account scope cannot access Store/POS/HR/business APIs.
- [x] Account registration creates no Tenant, Store, or membership.
- [x] Login returns account scope for one unambiguous active Account with no active memberships.
- [x] Pending requests survive refresh and approved memberships appear after refresh.
- [x] Legacy registration/onboarding endpoints remain available but are no longer primary frontend routes.

## Excluded

No schema migration, identity merge, legacy data deletion, permission-engine change, or new architecture phase.
