-- REQ-25 / PLAN-25
-- Additive canonical inventory foundation. No legacy stock is copied or removed.

DO $$ BEGIN
  CREATE TYPE public.inventory_movement_type AS ENUM (
    'RECEIVE', 'SALE', 'SALE_REVERSAL', 'WASTE', 'ADJUSTMENT',
    'PRODUCTION_CONSUMPTION', 'PRODUCTION_OUTPUT', 'TRANSFER_OUT', 'TRANSFER_IN'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- PostgreSQL needs an explicit unique target for the Ingredient/Tenant
-- composite FK. It is safe for current data because ingredients.id is already
-- the primary key and tenant_id is verified NOT NULL.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_ingredients_id_tenant'
      AND conrelid = 'public.ingredients'::regclass
  ) THEN
    ALTER TABLE public.ingredients
      ADD CONSTRAINT uq_ingredients_id_tenant UNIQUE (id, tenant_id);
  END IF;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.store_inventory_balances (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL,
  store_id integer NOT NULL,
  ingredient_id integer NOT NULL,
  on_hand_quantity numeric(18, 6) NOT NULL DEFAULT 0,
  average_unit_cost numeric(18, 4) NOT NULL DEFAULT 0,
  updated_by_user_id integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_store_inventory_balances_tenant_store_ingredient
    UNIQUE (tenant_id, store_id, ingredient_id),
  CONSTRAINT store_inventory_balances_tenant_id_tenants_id_fk
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT,
  CONSTRAINT store_inventory_balances_store_tenant_fk
    FOREIGN KEY (store_id, tenant_id) REFERENCES public.stores(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT store_inventory_balances_ingredient_tenant_fk
    FOREIGN KEY (ingredient_id, tenant_id) REFERENCES public.ingredients(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT store_inventory_balances_updated_by_user_id_users_id_fk
    FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT chk_store_inventory_balances_on_hand_non_negative
    CHECK (on_hand_quantity >= 0),
  CONSTRAINT chk_store_inventory_balances_average_cost_non_negative
    CHECK (average_unit_cost >= 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_store_inventory_balances_store
  ON public.store_inventory_balances(store_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_store_inventory_balances_ingredient
  ON public.store_inventory_balances(ingredient_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_store_inventory_balances_updated_by_user
  ON public.store_inventory_balances(updated_by_user_id);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL,
  store_id integer NOT NULL,
  ingredient_id integer NOT NULL,
  movement_type public.inventory_movement_type NOT NULL,
  quantity_delta numeric(18, 6) NOT NULL,
  unit_cost numeric(18, 4) NOT NULL DEFAULT 0,
  cost_delta numeric(18, 2) NOT NULL DEFAULT 0,
  reference_type varchar(80) NOT NULL,
  reference_id integer NOT NULL,
  reference_line_id integer,
  source_key varchar(255) NOT NULL,
  movement_group_id uuid NOT NULL,
  related_movement_id integer,
  reason_code varchar(100),
  note text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  posted_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id integer,
  CONSTRAINT inventory_movements_tenant_id_tenants_id_fk
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT,
  CONSTRAINT inventory_movements_store_tenant_fk
    FOREIGN KEY (store_id, tenant_id) REFERENCES public.stores(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT inventory_movements_ingredient_tenant_fk
    FOREIGN KEY (ingredient_id, tenant_id) REFERENCES public.ingredients(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT inventory_movements_related_movement_id_inventory_movements_id_fk
    FOREIGN KEY (related_movement_id) REFERENCES public.inventory_movements(id) ON DELETE RESTRICT,
  CONSTRAINT inventory_movements_created_by_user_id_users_id_fk
    FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT chk_inventory_movements_quantity_delta_non_zero
    CHECK (quantity_delta <> 0),
  CONSTRAINT chk_inventory_movements_unit_cost_non_negative
    CHECK (unit_cost >= 0),
  CONSTRAINT uq_inventory_movements_tenant_source_key
    UNIQUE (tenant_id, source_key)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_inventory_movements_store
  ON public.inventory_movements(store_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_inventory_movements_ingredient
  ON public.inventory_movements(ingredient_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_by_user
  ON public.inventory_movements(created_by_user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_inventory_movements_related
  ON public.inventory_movements(related_movement_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_inventory_movements_tenant_store_posted
  ON public.inventory_movements(tenant_id, store_id, posted_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_inventory_movements_tenant_store_ingredient_posted
  ON public.inventory_movements(tenant_id, store_id, ingredient_id, posted_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_inventory_movements_tenant_store_type_posted
  ON public.inventory_movements(tenant_id, store_id, movement_type, posted_at DESC);
--> statement-breakpoint

-- These tables are backend-only. RLS plus no Data API grants prevents a browser
-- client from using the ledger as an authorization bypass.
ALTER TABLE public.store_inventory_balances ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON public.store_inventory_balances, public.inventory_movements
  FROM anon, authenticated;
