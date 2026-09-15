-- REQ-25 hardening addendum. 0006 is already applied and remains immutable.
-- These columns preserve retry intent without deriving semantics from a later
-- Store balance/WAC value.
ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS unit_cost_supplied boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS cost_policy varchar(30) NOT NULL DEFAULT 'preserve';
--> statement-breakpoint

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_inventory_movements_cost_policy'
      AND conrelid = 'public.inventory_movements'::regclass
  ) THEN
    ALTER TABLE public.inventory_movements
      ADD CONSTRAINT chk_inventory_movements_cost_policy
      CHECK (cost_policy IN ('preserve', 'weighted_average'));
  END IF;
END $$;
--> statement-breakpoint

-- The old non-zero constraint remains. This narrows it to the approved
-- canonical movement semantics so a backend defect cannot persist a reversed
-- RECEIVE/SALE/TRANSFER direction.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_inventory_movements_quantity_delta_sign'
      AND conrelid = 'public.inventory_movements'::regclass
  ) THEN
    ALTER TABLE public.inventory_movements
      ADD CONSTRAINT chk_inventory_movements_quantity_delta_sign
      CHECK (
        (movement_type IN ('RECEIVE', 'SALE_REVERSAL', 'PRODUCTION_OUTPUT', 'TRANSFER_IN') AND quantity_delta > 0)
        OR (movement_type IN ('SALE', 'WASTE', 'PRODUCTION_CONSUMPTION', 'TRANSFER_OUT') AND quantity_delta < 0)
        OR (movement_type = 'ADJUSTMENT' AND quantity_delta <> 0)
      );
  END IF;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_inventory_movements_tenant_group
  ON public.inventory_movements(tenant_id, movement_group_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_inventory_movements_tenant_reference
  ON public.inventory_movements(tenant_id, reference_type, reference_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_inventory_movements_tenant_posted
  ON public.inventory_movements(tenant_id, posted_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_inventory_movements_tenant_type_posted
  ON public.inventory_movements(tenant_id, movement_type, posted_at DESC);
