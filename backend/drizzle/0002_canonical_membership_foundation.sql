-- Custom SQL migration file, put your code below! --
-- REQ-17 / PLAN-17. This is deliberately a custom additive migration because
-- the pre-existing Drizzle baseline is not a complete representation of the
-- current application schema. Do not replace it with a generated full diff.

DO $$ BEGIN
  CREATE TYPE public.membership_role AS ENUM ('owner', 'manager', 'leader', 'staff');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE public.membership_status AS ENUM ('active', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE public.store_access_scope AS ENUM ('all', 'selected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE public.membership_permission_effect AS ENUM ('allow', 'deny');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE public.tenant_join_request_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS join_code varchar(50);
--> statement-breakpoint
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS created_by integer;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_join_code
  ON public.tenants (join_code) WHERE join_code IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_tenants_created_by ON public.tenants (created_by);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tenants_created_by_users_id_fk'
      AND conrelid = 'public.tenants'::regclass
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_created_by_users_id_fk
      FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint

-- PostgreSQL requires a unique key matching each composite FK target below.
-- id remains the primary key; this pair carries the Tenant ownership proof.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_stores_id_tenant'
      AND conrelid = 'public.stores'::regclass
  ) THEN
    ALTER TABLE public.stores
      ADD CONSTRAINT uq_stores_id_tenant UNIQUE (id, tenant_id);
  END IF;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.tenant_memberships (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL,
  user_id integer NOT NULL,
  role public.membership_role NOT NULL DEFAULT 'staff',
  status public.membership_status NOT NULL DEFAULT 'active',
  store_access_scope public.store_access_scope NOT NULL DEFAULT 'selected',
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_tenant_memberships_tenant_user UNIQUE (tenant_id, user_id),
  CONSTRAINT uq_tenant_memberships_id_tenant UNIQUE (id, tenant_id),
  CONSTRAINT tenant_memberships_tenant_id_tenants_id_fk
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT tenant_memberships_user_id_users_id_fk
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_user_status
  ON public.tenant_memberships (user_id, status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_tenant_status
  ON public.tenant_memberships (tenant_id, status);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.membership_store_access (
  membership_id integer NOT NULL,
  store_id integer NOT NULL,
  tenant_id integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_membership_store_access_membership_store UNIQUE (membership_id, store_id),
  CONSTRAINT membership_store_access_membership_tenant_fk
    FOREIGN KEY (membership_id, tenant_id)
    REFERENCES public.tenant_memberships(id, tenant_id)
    ON DELETE CASCADE,
  CONSTRAINT membership_store_access_store_tenant_fk
    FOREIGN KEY (store_id, tenant_id)
    REFERENCES public.stores(id, tenant_id)
    ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_membership_store_access_store
  ON public.membership_store_access (store_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_membership_store_access_tenant
  ON public.membership_store_access (tenant_id);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.permissions (
  id serial PRIMARY KEY,
  key varchar(100) NOT NULL,
  name varchar(255) NOT NULL,
  module varchar(100) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT permissions_key_unique UNIQUE (key)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role public.membership_role NOT NULL,
  permission_id integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_role_permissions_role_permission UNIQUE (role, permission_id),
  CONSTRAINT role_permissions_permission_id_permissions_id_fk
    FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission
  ON public.role_permissions (permission_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.membership_permission_overrides (
  membership_id integer NOT NULL,
  permission_id integer NOT NULL,
  effect public.membership_permission_effect NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_membership_permission_overrides_membership_permission
    UNIQUE (membership_id, permission_id),
  CONSTRAINT membership_permission_overrides_membership_id_tenant_memberships_id_fk
    FOREIGN KEY (membership_id) REFERENCES public.tenant_memberships(id) ON DELETE CASCADE,
  CONSTRAINT membership_permission_overrides_permission_id_permissions_id_fk
    FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_membership_permission_overrides_permission
  ON public.membership_permission_overrides (permission_id);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.tenant_join_requests (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL,
  user_id integer NOT NULL,
  status public.tenant_join_request_status NOT NULL DEFAULT 'pending',
  assigned_role public.membership_role,
  reviewed_by integer,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_tenant_join_requests_assigned_role
    CHECK (assigned_role IS NULL OR assigned_role IN ('staff', 'leader', 'manager')),
  -- A cancelled request is withdrawn by the applicant and remains unreviewed.
  CONSTRAINT chk_tenant_join_requests_review_state CHECK (
    (status = 'pending' AND assigned_role IS NULL AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR (status = 'approved' AND assigned_role IS NOT NULL AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
    OR (status = 'rejected' AND assigned_role IS NULL AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
    OR (status = 'cancelled' AND assigned_role IS NULL AND reviewed_by IS NULL AND reviewed_at IS NULL)
  ),
  CONSTRAINT tenant_join_requests_tenant_id_tenants_id_fk
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT tenant_join_requests_user_id_users_id_fk
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT tenant_join_requests_reviewed_by_users_id_fk
    FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_join_requests_pending_user_tenant
  ON public.tenant_join_requests (tenant_id, user_id)
  WHERE status = 'pending';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_tenant_join_requests_tenant_status
  ON public.tenant_join_requests (tenant_id, status, created_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_tenant_join_requests_user_status
  ON public.tenant_join_requests (user_id, status, created_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_tenant_join_requests_reviewed_by
  ON public.tenant_join_requests (reviewed_by);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.employment_profiles (
  id serial PRIMARY KEY,
  membership_id integer NOT NULL,
  employee_code varchar(100),
  employment_type varchar(50),
  hourly_wage numeric(14, 2),
  monthly_salary numeric(14, 2),
  hire_date date,
  employment_status varchar(50),
  termination_date date,
  termination_reason text,
  date_of_birth date,
  id_card_number varchar(100),
  emergency_contact_name varchar(255),
  emergency_contact_phone varchar(20),
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_employment_profiles_membership UNIQUE (membership_id),
  CONSTRAINT employment_profiles_membership_id_tenant_memberships_id_fk
    FOREIGN KEY (membership_id) REFERENCES public.tenant_memberships(id) ON DELETE CASCADE
);
--> statement-breakpoint

ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.membership_store_access ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.membership_permission_overrides ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.tenant_join_requests ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.employment_profiles ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON public.tenant_memberships,
  public.membership_store_access,
  public.permissions,
  public.role_permissions,
  public.membership_permission_overrides,
  public.tenant_join_requests,
  public.employment_profiles
FROM anon, authenticated;
