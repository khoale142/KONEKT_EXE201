-- PLAN-15B: additive migration against the audited new database.
-- Do not replay PLAN-07/13/15/16 scripts or generate a full snapshot diff here.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_unassigned_email
  ON public.users (lower(email)) WHERE tenant_id IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_join_one_pending_user
  ON public.store_join_requests (user_id) WHERE status = 'pending' AND user_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_join_user_history ON public.store_join_requests (user_id, id DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_join_tenant_status ON public.store_join_requests (tenant_id, status, id DESC);
--> statement-breakpoint
ALTER TABLE public.store_join_requests ADD CONSTRAINT chk_join_status CHECK (status IN ('pending', 'approved', 'rejected'));
--> statement-breakpoint
ALTER TABLE public.store_join_requests ADD CONSTRAINT chk_join_assigned_role CHECK (assigned_role IS NULL OR assigned_role IN ('staff', 'shift_leader', 'store_manager'));
--> statement-breakpoint
-- KONEKT uses a trusted backend DB connection and its own numeric identity/JWT.
-- No Supabase client policy can safely map auth.uid() to these users.
ALTER TABLE public.store_join_requests ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- RLS does not protect TRUNCATE; these tables are backend-only.
REVOKE ALL ON public.users, public.stores, public.tenants, public.store_join_requests FROM anon, authenticated;
