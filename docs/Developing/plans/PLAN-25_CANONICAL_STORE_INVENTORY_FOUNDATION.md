# PLAN-25: Canonical Inventory Foundation and Future Workflow Roadmap

**Requirement:** REQ-25  
**Status:** Foundation complete and locked; roadmap only — no workflow implementation authorized  
**Date:** 15/09/2026

## 1. Plan boundary

This plan records the implementation order after the completed canonical
foundation. It does not authorize code, database, migration, UI, API, or legacy
replacement work. Migration `0006`, migration `0007`, and
`postInventoryMovements(...)` remain approved and unchanged.

The foundation is:

```text
Tenant Ingredient Catalog → Store Inventory Balance → Immutable Movement Ledger
```

It already supports Store WAC, immutable movements, deterministic source-key and
batch-group idempotency, multi-Store atomic groups, deterministic locking, future
transfer movement posting, and dashboard-oriented indexes.

## 2. Planned order and dependencies

| Order | Future workflow | Why it comes here |
| --- | --- | --- |
| 1 | Canonical foundation | Completed/locked prerequisite for every later write. |
| 2 | Receiving | Establishes reliable quantity/value and Store WAC inputs. |
| 3 | Stocktake | Establishes/reconciles an actual canonical Store balance and valid initial cost basis before POS cutover. |
| 4 | POS sale consumption | Uses BOM and idempotent SALE posting after a Store has a supported reconciliation path. |
| 5 | Waste | Reuses BOM/ledger cost snapshots after consumption is canonical. |
| 6 | Manual stock issue / adjustment | Adds controlled targeted corrections distinct from systematic Stocktake. |
| 7 | Store Transfer | Uses the existing multi-Store transaction boundary and source-cost policy. |
| 8 | Inventory Dashboard | Reads balances/movements only after canonical operational data exists. |

There is no Opening Inventory phase. The first actual Stocktake establishes the
initial balance through an `ADJUSTMENT` variance; a confirmed closing balance
automatically carries forward to the next day.

## 3. Future workflow delivery boundaries

### Receiving

- Persist a simple receipt/document with Store, Ingredient, quantity, total
  purchase amount, optional supplier text, reference text, and note.
- Normalize received quantity to the Ingredient base unit before calculating
  canonical unit cost and invoking `RECEIVE`; presentation units may remain
  friendly but must not alter canonical WAC math.
- Do not create Supplier Master, Purchase Order, package/box ERP, or procurement
  approval scope.

For example, 20 L at 600,000 VND becomes 20,000 ml and 30 VND/ml when the
canonical Ingredient unit is ml, even if the UI displays 30,000 VND/L.

### POS sale consumption

- Select the future inventory-finalized order event explicitly before coding.
- Resolve Product/Variant BOM to normalized Ingredient quantities and post
  idempotent Store-scoped `SALE` movements in the appropriate transaction.
- Consume a directly represented semi-finished Ingredient/BTP as that item; do
  not recursively expand its Sub-BOM during sale because production is deferred.
- Replace direct mutation of legacy `ingredients.current_stock`; do not redesign
  POS or decide Refund policy within this phase.

### Waste

- Support Ingredient waste and Product/Menu-Item waste expanded from a snapshot
  of applicable BOM.
- Consume a directly represented semi-finished Ingredient/BTP without recursive
  Sub-BOM expansion; production remains deferred.
- Persist workflow/document references sufficient for later audit and dashboard
  drilldown; post canonical `WASTE` movements at cost snapshot.
- Do not treat waste as revenue or implement a new approval hierarchy by default.

### Stocktake

- Persist a Stocktake document and item audit records, including checked
  zero-variance lines.
- Let the operator enter Actual Qty only; calculate theoretical quantity,
  variance, and value difference server-side.
- Post an `ADJUSTMENT` only when variance is non-zero. The first count may
  initialize zero theoretical balance; no special opening document is created.
- When that first positive count has no meaningful Store WAC, prefill a proposed
  initial unit cost from Ingredient/catalog cost where available and require
  confirmation/correction as needed. Post no positive initial balance with zero
  cost. Its posting is `INITIAL_COUNT` → `ADJUSTMENT` with caller-supplied
  `unitCost` and `weighted_average` policy. Later Stocktake variances use current
  Store cost and ask no cost again.
- Capture the theoretical snapshot used to prepare the count. On confirmation,
  validate it is not stale before posting variance; if Store inventory changed,
  require refresh/reconciliation and create no stale ledger movement.

### Manual stock issue / adjustment

- Provide targeted positive/negative `ADJUSTMENT` with reason and note.
- Keep the workflow separate from Stocktake's actual-vs-theoretical count.
- Guard it through effective canonical inventory permission plus StoreAccess.
- Retain source/reason classification that distinguishes `INITIAL_COUNT`,
  `STOCKTAKE_VARIANCE`, `MANUAL_ADJUSTMENT`, and internal
  issue/training/sample/giveaway for Dashboard analytics.

### Store Transfer

- Persist one transfer document and one movement group for `TRANSFER_OUT` and
  `TRANSFER_IN` across two Stores of the same Tenant.
- Validate source availability; post atomically via the existing multi-Store
  boundary; carry source WAC into destination WAC calculation.
- Do not create a separate warehouse, revenue, expense, or approval subsystem.

### Inventory Dashboard

- Derive quantities, current values, and period movement metrics from canonical
  balances and movements.
- Avoid duplicated inventory totals, materialized dashboard tables, or retail
  value assumptions unless a future requirement justifies them.

## 4. Authorization plan

Every workflow delivery must use canonical Account, active membership, StoreAccess,
and effective permission. Candidate permissions are `inventory.view`,
`inventory.receive`, `inventory.stocktake`, `inventory.waste`,
`inventory.adjust`, and `inventory.transfer`. A role is only a default permission
preset; it is not the business authorization check.

## 5. Existing-code integration plan

| Area | Classification | Planning action only |
| --- | --- | --- |
| Tenant ingredients / owner menu | KEEP / ADAPT | Retain the catalog; add canonical read/write integration only in its workflow phase. |
| Product and semi-finished BOM | KEEP / ADAPT | Preserve all recipe concepts; production is deferred. |
| `inventory-receipts` legacy repository | REPLACE PERSISTENCE | Plan canonical receipt and RECEIVE posting; no rewrite yet. |
| `inventory-audit` legacy opening snapshot | REPLACE PERSISTENCE | Replace with Stocktake theoretical/actual model; no opening module. |
| `inventory-disposals` legacy repository | REPLACE PERSISTENCE | Plan canonical Ingredient/Product waste postings; no rewrite yet. |
| Existing stocktake/waste/receipt UI | ADAPT | Reuse only where its workflow UX fits the canonical path. |
| `ingredients.current_stock` and direct POS deduction | REMOVE LATER | Keep compatibility until the POS consumption migration is complete. |
| `coffee_chain_db` inventory calls | REMOVE LATER | Retire per workflow only after a verified canonical replacement. |

## 6. Risks and decisions deferred deliberately

- Do not infer the order inventory-finalization event, refund/reversal policy,
  persistence schema for future documents, or inventory permission defaults.
- Do not add Supplier/PO, lots, expiry, FIFO/FEFO, reservation, production,
  complex accounting, or hardcoded role matrices.
- Confirm transfer cost treatment with any future accounting requirement before
  coding beyond the documented source-WAC target policy.
- Preserve semi-finished fields and Sub-BOM; do not mix production into this
  immediate roadmap.

## 7. Future validation template

Each future workflow must bring its own approved requirement/plan, focused
transaction and authorization tests, compatibility audit, build checks, and
rollback approach. It must use the existing canonical posting boundary rather
than reintroducing direct Store/Tenant inventory writes.

The first such delivery is detailed in PLAN-26. Its implementation may begin
only after that plan is approved; REQ-25 foundation/migrations 0006/0007 remain
locked throughout.
