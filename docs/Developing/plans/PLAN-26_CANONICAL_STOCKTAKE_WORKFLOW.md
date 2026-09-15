# PLAN-26: Canonical Store Stocktake Workflow

**Requirement:** REQ-26  
**Status:** Draft — awaiting user approval before runtime changes  
**Date:** 15/09/2026

## 1. Objective and delivery boundary

Implement only the canonical Store Stocktake workflow described by REQ-26. It will be the first workflow on the locked REQ-25 foundation and must use the existing Inventory Shift page and `inventory-audit` module as the visible and routing integration surface. The legacy batch/session system stays available for compatibility; canonical Stocktake becomes the primary path for a canonical workspace rather than a new, disconnected screen.

No Receiving, POS consumption, Refund, Waste, Manual Adjustment, Production, Transfer, Dashboard, Opening Inventory, or changes to migrations 0006/0007 are in this delivery.

## 2. Planned file changes

| Action | File | Planned change |
| --- | --- | --- |
| [CREATE] | `backend/drizzle/0008_canonical_stocktake_workflow.sql` | Add only canonical Stocktake document/line persistence, constraints, indexes, RLS, Data API privilege revokes, and the approved `inventory.stocktake` permission/default grants. Do not alter 0006/0007 or legacy audit tables. |
| [MODIFY] | `backend/src/db/schema.ts` | Add typed Drizzle definitions and relations for the new Stocktake tables; retain the locked balance/ledger definitions unchanged. |
| [CREATE] | `backend/src/modules/inventory/stocktake.service.ts` | Canonical snapshot/read/confirm logic, canonical authorization, stale verification, idempotent source-key construction, and the call to `postInventoryMovements(...)`. |
| [CREATE] | `backend/src/modules/inventory/stocktake.controller.ts` | Validate minimal HTTP input and map domain responses/errors without trusting Tenant or theoretical values from the client. |
| [MODIFY] | `backend/src/modules/inventory-audit/inventoryAudit.routes.ts` | Add canonical `/stocktakes` endpoints beneath the existing inventory-audit module, guarded by canonical Account/StoreAccess/effective permission middleware; preserve every legacy route. |
| [MODIFY] | `backend/src/modules/auth/canonicalAuthorization.service.ts` only if necessary | Reuse existing canonical helpers; add the smallest composable combined StoreAccess-plus-permission helper only if route/service usage would otherwise duplicate checks. |
| [MODIFY] | `frontend/src/features/staff/api/inventoryAudit.api.ts` | Add typed canonical Stocktake calls beside legacy inventory-audit calls; do not remove legacy API types. |
| [MODIFY] | `frontend/src/features/staff/pages/InventoryShiftPage.tsx` | Adapt the existing primary page for canonical workspace Stocktake: snapshot state, actual quantity inputs, first-baseline cost confirmation, stale-state refresh prompt, and confirmed audit display. Keep legacy path accessible rather than creating a parallel page. |
| [CREATE] | `backend/src/modules/inventory/__tests__/stocktake.service.test.ts` | Focused service/integration coverage for posting, cost basis, idempotency, authorization, and stale/concurrent snapshots. |
| [MODIFY] | existing canonical authorization/session focused test files | Add only tests needed for `inventory.stocktake`, active membership, and StoreAccess behavior. |
| [MODIFY] | `docs/Requirements/REQ-26_CANONICAL_STOCKTAKE_WORKFLOW.md` | Mark accepted criteria only after verified implementation. |
| [MODIFY] | `docs/Developing/plans/PLAN-26_CANONICAL_STOCKTAKE_WORKFLOW.md` | Mark completed steps/checks only after verified implementation. |
| [MODIFY] | `docs/Developing/logs/DEV_CHANGELOG.md` | Record implementation files, migration result, tests, and compatibility decisions. |

Exact migration number will be reconfirmed from the migration directory before creation. It is expected to be 0008 because 0006/0007 are locked and no later inventory migration exists.

## 3. Schema and invariants

1. Add a canonical Stocktake header scoped by `(tenant_id, store_id)` with draft/confirmed state, snapshot timestamp, creator/confirmer, and one stable reference ID suitable for ledger references.
2. Add immutable checked lines scoped to that header and Ingredient. Each line stores the theoretical quantity, theoretical WAC, balance revision/timestamp at snapshot, submitted actual quantity, calculated variance/value, and only the first-baseline proposed/confirmed unit cost when applicable.
3. Enforce Tenant-owned Store/Ingredient composite foreign keys, one Ingredient per Stocktake, non-negative actual quantity, decimal precision matching the canonical foundation, and indexes for Store history and confirmation reads.
4. Add permission metadata/default grants through the canonical permission tables, not a hardcoded legacy-role check. The exact default matrix will be inspected from the current role grant migration and recorded before applying; Owner remains an effective authorization result, not a special route bypass.
5. Enable RLS and revoke `anon`/`authenticated` Data API access consistently with the foundation. Backend authorization remains mandatory.

## 4. Implementation sequence

1. Re-read latest changelog, inspect the current migration numbering, existing permission seed/defaults, canonical session middleware, and route test harness. Fetch/scan the current Supabase changelog and relevant official docs before database implementation as required by the Supabase skill.
2. Add and apply the additive Stocktake migration, then inspect resulting constraints, RLS, indexes, grants, and no impact to legacy audit tables or 0006/0007 objects.
3. Extend Drizzle schema types for the new tables. No direct balance or ledger write is added outside `postInventoryMovements(...)`.
4. Build a canonical snapshot read in `stocktake.service.ts`: resolve canonical authorization, validate active StoreAccess and effective `inventory.stocktake`, enumerate Tenant Ingredient catalog entries, join Store balances, and persist the exact theoretical quantity/WAC/revision used in the counting form.
5. Build confirmation in one short, retry-safe transaction. Lock the Stocktake document, load ordered lines, read/lock relevant current balance rows in `(store_id, ingredient_id)` order, and compare each stored revision/value to current canonical state before preparing commands. Use serializable transaction isolation for the snapshot-validation-and-posting boundary so a concurrent creation/change of an initially absent balance cannot slip through as a phantom. Convert a serialization/stale result to domain/API 409 with no partial document, balance, or ledger write.
6. For each non-zero line, create an idempotent command with stable Stocktake/header-line source keys and one movement group. Initial positive baseline uses `ADJUSTMENT`, `INITIAL_COUNT`, supplied positive `unitCost`, and `weighted_average`; every normal variance uses `ADJUSTMENT`, `STOCKTAKE_VARIANCE`, and preserve policy with no client-supplied cost. Persist zero lines without commands. Confirm the document only after the whole posting result commits. A retry returns the already confirmed document rather than posting again.
7. Add controller/routes inside existing `inventory-audit` routing and typed client methods in the existing API file. Legacy endpoints and their data are not routed into canonical posting.
8. Adapt `InventoryShiftPage` rather than add a new page: canonical workspace enters count mode from a server snapshot, shows theoretical/actual/variance, displays first-baseline unit-cost confirmation only where required, disables duplicate confirmation while submitting, and shows a refresh/recount action on 409. Retain legacy UI route behavior as compatibility only.
9. Add test coverage, run the validation suite, update REQ/PLAN checklists and changelog, then review the final diff for scope leakage.

## 5. Concurrency and rollback

- Confirmation holds no user interaction or network call inside its transaction; it locks only document/balance rows for the minimum posting interval.
- It uses the foundation's deterministic Store/Ingredient ordering and source keys. The serializable confirmation transaction detects concurrent changes, including a balance row that did not exist at snapshot time; such a conflict is safely returned as 409/recount, not silently rebased.
- No existing data is rewritten. Rollback is to disable the new canonical Stocktake endpoints/UI branch and, if necessary, roll back the one additive migration only after confirming no canonical Stocktake records exist. Legacy inventory-audit behavior is preserved as the operational fallback.

## 6. Validation plan

- Migration apply/rerun plus catalog assertions for constraints, tenant FKs, RLS, indexes, and Data API grants.
- Focused canonical Stocktake tests:
  - snapshot/form derives from Store canonical balances, not legacy stock;
  - first positive baseline rejects missing/zero cost and then posts `INITIAL_COUNT` as `ADJUSTMENT + supplied unitCost + weighted_average`;
  - normal variance uses preserve policy/current WAC; zero variance has an audit line and no movement;
  - repeated confirmation is idempotent with no duplicate balance/ledger change;
  - a canonical movement after snapshot makes confirm return an asserted 409, with no Stocktake variance movement;
  - a real concurrent overlap gives exactly one confirmed/recount-safe result and leaves no partial write;
  - cross-Tenant, inactive membership, missing permission, and missing StoreAccess are denied.
- Run canonical authorization tests and canonical workspace/session tests.
- Run backend build/typecheck, frontend build, and `git diff --check`.
- Manually verify the existing Inventory Shift route opens the canonical count experience for an authorized canonical workspace, 409 offers refresh/recount, and legacy audit routes are still reachable.

## 7. Risks and decisions to confirm during implementation

- **Permission defaults:** the existing canonical permissions currently do not include `inventory.stocktake`; the migration will add the smallest safe default grants after inspecting current role permission conventions. It will not use legacy `staff`/`store_manager` HTTP guards as authorization.
- **No stock catalog entries:** whether a Store starts a Stocktake with every active Tenant Ingredient or a server-filtered selected subset must be resolved against the existing Ingredient active/category semantics before coding. The chosen list must still persist every displayed/countable line and support a reliable stale check.
- **Initial unit cost:** catalog cost is a prefill only. If absent or zero, the operator must enter a positive cost; a zero-cost positive baseline remains rejected.
