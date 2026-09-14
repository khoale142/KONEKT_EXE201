# PLAN-24 - Canonical Store-Invite Employee Onboarding

**Requirement:** [REQ-24](../../Requirements/REQ-24_CANONICAL_STORE_INVITE_ONBOARDING.md)  
**Status:** Owner HR integration implemented and verified

## Changes

1. Retain the additive nullable `tenant_join_requests.requested_store_id` migration; a Store code now creates the primary canonical pending request.
2. Permit account-scope canonical sessions to verify a Store invite, submit one pending request per Account/Tenant, and retrieve that request after refresh.
3. Resolve Store/Tenant server-side in a transaction and insert only the request with `requested_store_id`; never mint a workspace session, membership, or Store-access row at submission.
4. Preserve the Owner approval path: lock the pending request, accept STAFF/LEADER/MANAGER only, validate all selected Stores belong to the active Tenant, create or activate one selected-scope membership, and replace its selected Store access atomically.
5. Keep the employee on the pending UI after submission; refresh workspace data only after Owner approval, then use the existing one-Store auto-selection or Store selector.
6. Keep the Owner Store-code panel and legacy compatibility routes without deleting tables or endpoints.
7. Reuse the canonical request-review component inside the existing Owner HR request tab, preserve the legacy request UI below it, and include both pending sources in the Owner HR badge.

## Verification

- Transaction-rolled-back focused fixture covers pending creation without membership/access, pending API denial, Owner STAFF/MANAGER approval, one/multiple Store access, refresh, OWNER rejection, cross-Tenant rejection, and duplicate-pending safety.
- Backend TypeScript build and frontend TypeScript/Vite build.
