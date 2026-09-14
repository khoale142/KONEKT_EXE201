# PLAN-19 — Canonical Tenant Lifecycle

**Requirement:** [REQ-19](../../Requirements/REQ-19_TENANT_CREATION_JOIN_AND_APPROVAL.md)  
**Status:** Implemented

## Files

- `[NEW]` canonical tenant lifecycle service and focused unit checks.
- `[MODIFY]` workspace controller/routes/schema, canonical workspace listing, workspace client and Tenant selector UI.
- `[MODIFY]` REQ-19, this plan, and development log.

## Implementation

1. Use canonical JWT Account IDs only; create Tenant/Store/owner membership transactionally.
2. Resolve reusable join codes server-side; create pending canonical requests without applicant-selected role.
3. Check active Owner membership before review; lock pending request, validate same-Tenant Store IDs, and approve/reject/cancel transactionally.
4. Refresh workspace data in UI after creation/approval-related state changes.

## Risks and verification

- Unique pending-request and composite Store-access FKs remain database enforcement; service returns safe conflicts.
- No schema/migration/data-destructive action is required. Run focused checks plus backend/frontend builds.
