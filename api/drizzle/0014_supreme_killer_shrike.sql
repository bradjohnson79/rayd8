CREATE TYPE "public"."affiliate_tracking_result" AS ENUM('success', 'warning', 'error');--> statement-breakpoint
CREATE TABLE "affiliate_tracking_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"result" "affiliate_tracking_result" DEFAULT 'success' NOT NULL,
	"referral_code" text,
	"affiliate_user_id" text,
	"referred_user_id" text,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_invoice_id" text,
	"stripe_event_id" text,
	"has_referral_metadata" boolean,
	"commission_created" boolean,
	"message" text DEFAULT '' NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "affiliate_tracking_events" ADD CONSTRAINT "affiliate_tracking_events_affiliate_user_id_users_id_fk" FOREIGN KEY ("affiliate_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_tracking_events" ADD CONSTRAINT "affiliate_tracking_events_referred_user_id_users_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "affiliate_tracking_events_type_idx" ON "affiliate_tracking_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "affiliate_tracking_events_result_idx" ON "affiliate_tracking_events" USING btree ("result");--> statement-breakpoint
CREATE INDEX "affiliate_tracking_events_created_at_idx" ON "affiliate_tracking_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "affiliate_tracking_events_subscription_idx" ON "affiliate_tracking_events" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "affiliate_tracking_events_referral_code_idx" ON "affiliate_tracking_events" USING btree ("referral_code");