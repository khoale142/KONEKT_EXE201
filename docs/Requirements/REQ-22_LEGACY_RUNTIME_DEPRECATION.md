# REQ-22 — Legacy Runtime Deprecation

**Status:** Approved for implementation

## Goal

Keep canonical Account → TenantMembership → StoreAccess as the authority and retire only legacy runtime entry points proven unused. Preserve historical data and compatibility paths still called by the shipped frontend.

## Scope

- Stop advertising obsolete migration/backfill commands that target tables absent from the development schema.
- Record the compatibility dependencies that must remain: legacy portal login, staff registration/store onboarding, legacy HR attendance/schedule/payroll APIs, and legacy User fields used by those flows.
- Confirm no schema deletion, no creation of missing HR tables, and no mutation of the three unmapped `shift_sessions` rows.

## Acceptance criteria

- [x] Canonical login/session and membership-scoped `shift_sessions` writes are unchanged.
- [x] No package command remains that invites execution of the absent payroll/schedule migrations or schedule-change backfill.
- [x] Active frontend consumers of legacy attendance/schedule/payroll and onboarding remain functional at the routing layer.
- [x] Backend/frontend builds and canonical tests pass.

## Excluded

No dropping legacy columns/tables, no creation of missing attendance/schedule/payroll tables, no historical-data deletion, and no Phase 7 work.
