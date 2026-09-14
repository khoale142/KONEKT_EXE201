# PLAN-22 — Legacy Runtime Deprecation

**Requirement:** [REQ-22](../../Requirements/REQ-22_LEGACY_RUNTIME_DEPRECATION.md)  
**Status:** Implemented

## Files

- [MODIFY] `backend/package.json` — remove obsolete schedule-change backfill command.
- [CREATE] `backend/src/scripts/audit_legacy_runtime.ts` — read-only schema evidence.
- [CREATE] `docs/Requirements/REQ-22_LEGACY_RUNTIME_DEPRECATION.md`.
- [CREATE] `docs/Developing/plans/PLAN-22_LEGACY_RUNTIME_DEPRECATION.md`.
- [MODIFY] `docs/Developing/logs/DEV_CHANGELOG.md` — evidence and retained dependencies.

## Steps

1. [x] Verify catalog/runtime consumers and retain all paths with frontend callers.
2. [x] Remove obsolete absent-table command entry points; retain all frontend-consumed auth paths.
3. [x] Run canonical session/authorization/workforce tests and both builds.
4. [x] Record retained legacy dependencies and no-destructive-operation result.

## Risks and rollback

Removing an unobserved external client route is the main risk. Rollback is to restore the mount/endpoint from version control; no database data changes occur.
