# REQ-26: Canonical Store Stocktake Workflow

**Status:** Draft — awaiting implementation-plan approval  
**Date:** 15/09/2026  
**Depends on:** REQ-25 locked canonical Store inventory foundation

## 1. Goal and context

Deliver the first operational workflow on the locked canonical inventory foundation: a Store-scoped Stocktake that reconciles a captured theoretical balance with an employee's actual count. It uses canonical balances and the immutable movement ledger only; it must not read or update legacy `coffee_chain_db.stock_levels` or `ingredients.current_stock` as inventory authority.

This is **not** an Opening Inventory module. A first Stocktake may establish a positive canonical baseline only when its Store/Ingredient has no meaningful canonical WAC. Its required posting contract is:

```text
INITIAL_COUNT positive baseline
→ ADJUSTMENT + supplied unitCost + weighted_average cost policy
```

The workflow is part of the existing inventory-audit operational surface. The existing Inventory Shift page is the primary UI to adapt; legacy batch/session endpoints and tables remain compatible until a later, deliberate retirement.

## 2. User stories

- As an authorized Store inventory operator, I can start a Stocktake from the existing Inventory Shift page and see a server-created theoretical snapshot so I can enter actual quantities without choosing a movement type or variance.
- As an operator making the first positive count for an uncosted Store balance, I can see a proposed unit cost from the existing Ingredient/catalog cost and confirm or correct it, so the initial quantity has a real cost basis.
- As an operator, I am prevented from confirming a stale count, so a movement posted after my snapshot cannot be overwritten by an obsolete variance.
- As an authorized Tenant/Store user, I can view a confirmed Stocktake and its checked zero-variance lines for audit purposes.

## 3. In scope

- Store- and Tenant-scoped canonical Stocktake document and immutable line audit records, including zero-variance checked lines.
- Server-side theoretical quantity/cost snapshot, actual-quantity input, server-calculated variance/value difference, and stale-snapshot rejection.
- First positive baseline cost confirmation and canonical `ADJUSTMENT` posting through `postInventoryMovements(...)` with `INITIAL_COUNT` classification, supplied `unitCost`, and `weighted_average` policy.
- Normal Stocktake variances classified as `STOCKTAKE_VARIANCE`, using the current Store cost basis and no new cost entry.
- Atomic, idempotent confirmation with canonical Account, active membership, StoreAccess, and effective `inventory.stocktake` authorization.
- Adaptation of the existing `inventory-audit` backend module, its client API, and `InventoryShiftPage`; legacy inventory-audit behavior remains intact.
- Focused persistence, authorization, stale/concurrency, and UI API tests.

## 4. Out of scope

- Opening Inventory, Receiving, POS sale consumption, refund, Waste, Manual Adjustment, Production, Store Transfer, and Inventory Dashboard workflows.
- Supplier/PO, packages/boxes, lots, expiry, FIFO/FEFO, inventory approvals, and any new hardcoded role matrix.
- Rewriting or deleting legacy `coffee_chain_db` audit tables/endpoints, direct POS stock compatibility, or the locked REQ-25 foundation/migrations 0006/0007.
- Recursive expansion of a semi-finished Ingredient/BTP Sub-BOM.

## 5. Business and security rules

1. The server derives Tenant and Store scope from the canonical session and validates StoreAccess; no client-provided Tenant is trusted.
2. The operator submits Actual Qty only. The server owns theoretical quantity, variance, value difference, and movement payloads.
3. A non-zero variance creates one signed `ADJUSTMENT` per checked Ingredient; a zero variance creates no movement but remains an immutable checked line.
4. `INITIAL_COUNT` is permitted only for a positive first baseline where the snapshot has zero theoretical quantity and no meaningful Store WAC. It must supply a strictly positive confirmed unit cost and use `weighted_average`. Positive initial stock must never be silently posted at zero cost.
5. Normal variances use `STOCKTAKE_VARIANCE` with the captured/current Store cost basis under preserve policy; the client cannot inject a new cost.
6. The created snapshot includes the canonical balance revision/value for every line. Confirmation rejects with a domain/API `409` if any counted Ingredient changed after the snapshot. It creates no movement on a stale snapshot.
7. Confirmation locks and posts only in a short transaction, uses deterministic Store/Ingredient ordering, and uses stable Stocktake document/line source keys so a retry cannot create duplicate movements.
8. A pending/draft Stocktake is not an inventory authorization grant. Every read/write endpoint requires active canonical membership, StoreAccess, and the effective inventory permission; authorization never depends on a legacy portal or role check.
9. `ADJUSTMENT` remains the only canonical movement type. `referenceType`, reference IDs, source keys, and `reasonCode` distinguish `INITIAL_COUNT` from `STOCKTAKE_VARIANCE` for audit and future Dashboard analytics.

## 6. Acceptance criteria

- [ ] An authorized canonical Store user can create/read a Store Stocktake from the existing Inventory Shift experience; every returned line belongs to the active Tenant and accessible Store.
- [ ] Theoretical quantity is taken from `store_inventory_balances`; legacy `stock_levels` and `ingredients.current_stock` are not used for canonical Stocktake persistence or posting.
- [ ] First positive count at zero/no meaningful WAC requires a positive confirmed unit cost and posts `ADJUSTMENT`, `INITIAL_COUNT`, supplied unit cost, and `weighted_average`; the resulting WAC is valid.
- [ ] A normal non-zero count posts exactly one `ADJUSTMENT` classified `STOCKTAKE_VARIANCE`; a zero variance persists its audit line but posts none.
- [ ] If a relevant canonical balance changes after snapshot creation, confirmation returns a domain/API 409 and leaves document status, balances, and ledger unchanged.
- [ ] Retrying a successful confirmation is idempotent: it returns the same confirmed document/group and does not duplicate movements or balance changes.
- [ ] Cross-Tenant, inaccessible Store, inactive membership, or missing `inventory.stocktake` permission requests are denied.
- [ ] The existing legacy inventory-audit routes/tables remain available and no prohibited workflow is introduced.
