ALTER TABLE "users" ADD COLUMN "normalized_email" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "billing_conflict_review_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "users_normalized_email_lookup_idx" ON "users" USING btree ("normalized_email");--> statement-breakpoint
CREATE INDEX "users_stripe_customer_lookup_idx" ON "users" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "users_billing_conflict_review_idx" ON "users" USING btree ("billing_conflict_review_required");--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "pending_downgrade_plan" "plan";--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "past_due_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "status_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "stripe_event_created_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "subscriptions_user_status_plan_idx" ON "subscriptions" USING btree ("user_id","status","plan");--> statement-breakpoint
CREATE INDEX "subscriptions_event_created_idx" ON "subscriptions" USING btree ("stripe_event_created_at");--> statement-breakpoint
ALTER TABLE "stripe_events" ADD COLUMN "status" text DEFAULT 'completed' NOT NULL;--> statement-breakpoint
ALTER TABLE "stripe_events" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "stripe_events" ADD COLUMN "claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stripe_events" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stripe_events" ADD COLUMN "failed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stripe_events" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "stripe_events" ADD COLUMN "stripe_created_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "stripe_events_status_claimed_idx" ON "stripe_events" USING btree ("status","claimed_at");--> statement-breakpoint
CREATE INDEX "stripe_events_created_idx" ON "stripe_events" USING btree ("stripe_created_at");--> statement-breakpoint
CREATE TABLE "billing_checkout_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "action" text NOT NULL,
  "target_plan" "plan" NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "stripe_session_id" text,
  "idempotency_key" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "billing_checkout_attempts" ADD CONSTRAINT "billing_checkout_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_checkout_attempts_idempotency_idx" ON "billing_checkout_attempts" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "billing_checkout_attempts_user_status_idx" ON "billing_checkout_attempts" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "billing_checkout_attempts_stripe_session_idx" ON "billing_checkout_attempts" USING btree ("stripe_session_id");
