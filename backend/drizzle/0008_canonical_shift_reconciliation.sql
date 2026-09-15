ALTER TABLE "shift_sessions" ADD COLUMN "closed_by_membership_id" integer;--> statement-breakpoint
ALTER TABLE "shift_sessions" ADD COLUMN "reconciled_by_membership_id" integer;--> statement-breakpoint
ALTER TABLE "shift_sessions" ADD COLUMN "reconciled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shift_sessions" ADD CONSTRAINT "shift_sessions_closed_by_membership_id_tenant_memberships_id_fk" FOREIGN KEY ("closed_by_membership_id") REFERENCES "public"."tenant_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_sessions" ADD CONSTRAINT "shift_sessions_reconciled_by_membership_id_tenant_memberships_id_fk" FOREIGN KEY ("reconciled_by_membership_id") REFERENCES "public"."tenant_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_shift_sessions_open_store" ON "shift_sessions" USING btree ("tenant_id","store_id") WHERE "shift_sessions"."status" = 'open';
