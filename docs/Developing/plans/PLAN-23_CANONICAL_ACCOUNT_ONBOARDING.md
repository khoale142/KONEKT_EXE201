# PLAN-23 — Canonical Account Onboarding Integration

**Requirement:** [REQ-23](../../Requirements/REQ-23_CANONICAL_ACCOUNT_ONBOARDING.md)  
**Status:** Implemented and verified

## Implementation

1. Add account-only canonical session issue/resolve/refresh/hydration and route whitelist.
2. Add global Account registration; redirect primary legacy registration URLs to the generic Account page.
3. Extend workspace listing with pending requests and Owner-only Tenant join codes.
4. Update Workspace Hub, Tenant join, and request review UI for `KON-...`, pending state, copy code, and approval navigation.
5. Run canonical tests and builds; no database write outside normal runtime behavior.

## Verification

- `npm run test:canonical-workspace-session` passed (14 assertions, including account-only claim isolation).
- `npm run test:canonical-authorization` passed (4 assertions).
- Backend TypeScript build and frontend TypeScript/Vite build passed.

## Risk and rollback

Account tokens carry no membership, Tenant, Store, role, or permission authority. Restoring the former frontend routes is a source-only rollback; no database schema/data migration is involved.
