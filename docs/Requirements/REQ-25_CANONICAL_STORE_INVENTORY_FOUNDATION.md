# REQ-25: Canonical Inventory Foundation and Business Roadmap

**Status:** Foundation completed and locked; business workflows are future work only  
**Date:** 15/09/2026  
**Scope of this revision:** Documentation and planning only

## 1. Canonical foundation — completed / locked

The inventory source of truth is fixed as:

```text
Tenant Ingredient Catalog
  → Store Inventory Balance
  → Immutable Inventory Movement Ledger
```

The completed foundation provides Store-scoped balances and weighted-average cost
(WAC), immutable signed movements, source-key and batch-group idempotency,
multi-Store atomic posting, deterministic Store/Ingredient balance locking, and
indexes for future transfer and dashboard queries. `ingredients.current_stock`
remains legacy compatibility data only; new canonical workflows must not use it
as their inventory authority.

Supported canonical movement types remain unchanged:

- `RECEIVE`, `SALE`, `SALE_REVERSAL`, `WASTE`, `ADJUSTMENT`
- `PRODUCTION_CONSUMPTION`, `PRODUCTION_OUTPUT`, `TRANSFER_OUT`, `TRANSFER_IN`

No change to migration `0006`, migration `0007`, the schema, or
`postInventoryMovements(...)` is implied by this document.

## 2. Explicitly removed concept: no Opening Inventory module

There will be no separate Opening Inventory page, opening document, or daily
opening-stock workflow. The first real Store Stocktake may establish initial
canonical quantity: when theoretical quantity is zero and actual count is 20 kg,
the variance is `ADJUSTMENT +20 kg` with a reason identifying initialization.

After a confirmed count, its closing balance is naturally the next day's opening
balance. Staff never re-enter every ingredient each morning and inventory is never
reset to zero daily.

## 3. Future user-facing business scope

Only these workflows are planned on top of the locked foundation:

1. Receiving
2. Stocktake / end-of-day inventory count
3. POS sale consumption through BOM
4. Waste, by Ingredient or Product/Menu Item
5. Manual stock issue / adjustment
6. Store Transfer
7. Inventory Dashboard

Production remains a later concept for semi-finished items; it is not part of the
immediate roadmap. Supplier master, purchase orders, lots, expiry, FIFO/FEFO,
reservations, warehouse picking, ERP procurement approvals, complex accounting
valuation, and hardcoded role authorization are out of scope.

## 4. Future workflow definitions

### 4.1 Receiving

A simple receiving document records Store, Ingredient, received quantity, and
total purchase amount. Quantity must be normalized to the Ingredient's canonical
base unit before calculating the canonical received unit cost or posting `RECEIVE`.
For example, 20 L received for 600,000 VND becomes 20,000 ml when the base unit is
ml, so canonical cost is `600,000 / 20,000 = 30 VND/ml` (although UI may display
30,000 VND/L). Store WAC must use those normalized values to avoid unit-scale
costing errors. Supplier name, invoice/reference number, and note may be free text
only; no supplier, package/box ERP, or PO module is required.

### 4.2 POS sale consumption

When a POS sale reaches the future inventory-finalization boundary, the system
must resolve Product/Variant BOM quantities into normalized Ingredient base units
and post idempotent Store-scoped `SALE` movements in the same business boundary.
The exact order-finalization event and refund policy are deliberately not decided
by this roadmap. Legacy direct deduction of `ingredients.current_stock` must be
replaced at that future integration point, not extended.

If a Product BOM directly contains a semi-finished Ingredient/BTP, POS consumes
that represented Ingredient/BTP directly. It must not recursively expand its
Sub-BOM during sale; production remains a future workflow.

### 4.3 Waste

Ingredient waste posts `WASTE` with reason and the Store cost snapshot at posting.
Product/Menu-Item waste snapshots its applicable BOM, expands it into Ingredient
`WASTE` movements, and retains enough reference/snapshot information that later
BOM edits cannot reinterpret historical waste. It is not a sale and creates no
revenue.

Likewise, if a waste Product BOM directly contains a semi-finished Ingredient/BTP,
the waste posting consumes that represented Ingredient/BTP directly. It does not
recursively consume the Sub-BOM; production remains future scope.

### 4.4 Stocktake

Stocktake compares each counted ingredient's theoretical Store quantity with
actual quantity entered by the employee:

```text
variance = actual quantity - theoretical quantity
```

The UI presents Ingredient, System Qty, Actual Qty, Variance, and Value
Difference; the employee enters only Actual Qty. A non-zero variance posts an
`ADJUSTMENT` that brings the Store balance to the actual count. A zero-variance
line writes no movement, but stays recorded as checked in the Stocktake document.
The first Stocktake can initialize a Store as described in section 2.

If that first Stocktake establishes positive quantity and the Store has no
meaningful canonical WAC, quantity alone is insufficient. The same Stocktake must
establish a valid initial inventory cost basis: it may prefill from the existing
Ingredient/catalog cost and require confirmation or correction where needed. It
must never silently post positive initial stock at zero cost. Once Store WAC is
valid, ordinary Stocktake variance adjustments use the current Store cost basis
and do not ask for cost again.

For the positive first baseline, the canonical posting contract is explicitly:

```text
INITIAL_COUNT positive baseline
→ ADJUSTMENT + supplied unitCost + weighted_average cost policy
```

Stocktake must also capture the theoretical quantity snapshot used to show the
counting form. On confirmation, the server validates that snapshot has not become
stale before it posts a variance. If canonical inventory changed after the
snapshot, it must require refresh/reconciliation and post no stale variance.

### 4.5 Manual stock issue / adjustment

Manual adjustment is distinct from Stocktake: it is a targeted operational change
or correction, such as training use, samples, internal use, giveaway, known
discrepancy, correction increase/decrease, or other documented reason. It uses
signed `ADJUSTMENT` movements with reason/note; no new movement type is needed.

Future documents/postings must classify `ADJUSTMENT` through existing source,
reference, and reason capabilities sufficiently to distinguish at least
`INITIAL_COUNT`, `STOCKTAKE_VARIANCE`, `MANUAL_ADJUSTMENT`, and operational
internal issue/training/sample/giveaway. Dashboard analytics must not report an
initial baseline as ordinary daily shrinkage or Stocktake variance.

### 4.6 Store Transfer

A transfer within one Tenant uses one transfer document and movement group:

```text
Source Store:      TRANSFER_OUT
Destination Store: TRANSFER_IN
```

Both movements must commit in one transaction or roll back together. Target cost
policy is to carry the source Store WAC snapshot on both movements; destination
WAC then recalculates from its existing inventory value plus the incoming quantity
and carried value. A transfer changes neither Tenant revenue nor expense. This is
the target business policy, not an implemented workflow or accounting policy.

### 4.7 Inventory Dashboard

The dashboard is derived from canonical balances and movements, not a second
inventory total. Future views include current quantity/value by Store and
Ingredient, and period-based receiving, POS consumption, waste, manual
adjustment, Stocktake variance, and transfer cost impact. Waste drilldown covers
product, ingredient, and reason; Stocktake shows theoretical/actual/variance;
transfer shows source, destination, quantity, and inventory value. Values are
inventory cost, never retail selling price unless a later requirement says so.

## 5. Theoretical inventory and costing rules

Theoretical Store quantity remains continuous:

```text
previous confirmed quantity
+ receiving
- POS consumption
- waste
± manual adjustment
- transfer out
+ transfer in
= current theoretical quantity
```

End-of-day Stocktake compares this result with actual count and posts only the
variance. Receiving changes Store WAC. Outgoing movements (SALE, WASTE, negative
ADJUSTMENT, and TRANSFER_OUT) use the inventory cost snapshot chosen at posting
and do not arbitrarily recalculate WAC downward. Incoming transfer carries source
cost and recalculates destination WAC. Stocktake variance value uses the Store
cost basis at posting time, except that a first positive baseline must establish
the initial valid Store cost basis within that Stocktake.

## 6. Future authorization boundary

Future inventory routes must require:

```text
authenticated Account → ACTIVE TenantMembership → StoreAccess → effective permission
```

Authorization must use effective canonical permissions, never hardcoded Owner,
Manager, or Staff checks. Likely permission concepts are `inventory.view`,
`inventory.receive`, `inventory.stocktake`, `inventory.waste`,
`inventory.adjust`, and `inventory.transfer`; their final defaults and grants are
future work. Permission must never bypass StoreAccess.

## 7. Legacy integration planning matrix

| Existing area | Roadmap decision | Future direction |
| --- | --- | --- |
| Ingredient/Menu UI and Tenant ingredient catalog | KEEP / ADAPT | Keep catalog management; show canonical Store data only through future read models. |
| Product BOM (`product_recipes`) | KEEP / ADAPT | Reuse as input for POS/Waste expansion; snapshot business inputs when posting. |
| Semi-finished catalog/Sub-BOM | KEEP | Preserve `item_type`, `batch_yield`, and `semi_finished_recipes`; production stays later. |
| Legacy receipt UI/API | ADAPT / REPLACE PERSISTENCE | Reuse operational UX only if suitable; replace `coffee_chain_db`/`stock_levels` persistence with canonical RECEIVE posting. |
| Legacy audit/stocktake UI | ADAPT / REPLACE PERSISTENCE | Replace opening snapshot and `coffee_chain_db.stock_levels` model with theoretical-versus-actual Stocktake. |
| Legacy disposal/waste UI/API | ADAPT / REPLACE PERSISTENCE | Map Ingredient/Product waste into canonical WASTE movements and immutable snapshots. |
| `ingredients.current_stock` | KEEP COMPATIBILITY / REMOVE LATER | Do not backfill or treat as canonical; retire only after each caller is migrated. |
| `coffee_chain_db` inventory repositories | REPLACE PERSISTENCE | Preserve for compatibility until each workflow has a canonical replacement. |
| Current direct POS stock deduction | REPLACE PERSISTENCE | Replace with idempotent BOM-to-SALE integration at the chosen finalization boundary. |

## 8. Acceptance criteria for the roadmap

- [x] Foundation architecture and approved movement types are documented as
  completed and locked.
- [x] Separate Opening Inventory and daily re-entry are removed from the roadmap.
- [x] Future scope is limited to Receiving, POS consumption, Waste, Stocktake,
  Manual Adjustment, Transfer, and Dashboard.
- [x] Stocktake, WAC, transfer costing, ledger-derived reporting, permission,
  and legacy replacement principles are documented without claiming implementation.
- [x] Semi-finished concepts remain preserved and production is deferred.
- [x] The first implementable workflow is specified separately in REQ-26, with
  initial-cost and stale-snapshot Stocktake invariants retained here as the
  locked foundation roadmap.
