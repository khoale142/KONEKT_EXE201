ALTER TABLE "orders" ADD COLUMN "shift_session_id" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "shift_session_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_shift_session_id_shift_sessions_id_fk" FOREIGN KEY ("shift_session_id") REFERENCES "public"."shift_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_shift_session_id_shift_sessions_id_fk" FOREIGN KEY ("shift_session_id") REFERENCES "public"."shift_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_orders_shift_session" ON "orders" USING btree ("shift_session_id");--> statement-breakpoint
CREATE INDEX "idx_payments_shift_session" ON "payments" USING btree ("shift_session_id");