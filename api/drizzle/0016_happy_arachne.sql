CREATE TYPE "public"."promo_code_applies_to_plan" AS ENUM('regen', 'amrita', 'all');--> statement-breakpoint
CREATE TYPE "public"."promo_code_discount_type" AS ENUM('percent', 'amount');--> statement-breakpoint
CREATE TYPE "public"."promo_code_duration" AS ENUM('once', 'repeating', 'forever');--> statement-breakpoint
CREATE TYPE "public"."promo_code_sync_status" AS ENUM('synced', 'pending', 'error', 'inactive', 'missing', 'mismatch');--> statement-breakpoint
CREATE TABLE "rayd8_promo_code_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promo_code_id" uuid,
	"user_id" text,
	"code" text NOT NULL,
	"stripe_coupon_id" text,
	"stripe_promotion_code_id" text,
	"stripe_checkout_session_id" text,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_invoice_id" text,
	"amount_discounted" integer,
	"currency" text DEFAULT 'usd' NOT NULL,
	"status" text DEFAULT 'applied' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rayd8_promo_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"discount_type" "promo_code_discount_type" NOT NULL,
	"percent_off" integer,
	"amount_off" integer,
	"currency" text DEFAULT 'usd' NOT NULL,
	"duration" "promo_code_duration" NOT NULL,
	"duration_in_months" integer,
	"max_redemptions" integer,
	"times_redeemed" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"applies_to_plan" "promo_code_applies_to_plan" DEFAULT 'regen' NOT NULL,
	"stripe_coupon_id" text,
	"stripe_promotion_code_id" text,
	"stripe_environment" text DEFAULT 'unknown' NOT NULL,
	"stripe_sync_status" "promo_code_sync_status" DEFAULT 'pending' NOT NULL,
	"stripe_sync_error" text,
	"created_by_admin_id" text,
	"affiliate_id" text,
	"campaign_id" text,
	"referral_source" text,
	"commission_eligible" boolean,
	"commission_status" text,
	"payout_batch_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "rayd8_promo_code_redemptions" ADD CONSTRAINT "rayd8_promo_code_redemptions_promo_code_id_rayd8_promo_codes_id_fk" FOREIGN KEY ("promo_code_id") REFERENCES "public"."rayd8_promo_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rayd8_promo_code_redemptions" ADD CONSTRAINT "rayd8_promo_code_redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rayd8_promo_codes" ADD CONSTRAINT "rayd8_promo_codes_created_by_admin_id_users_id_fk" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rayd8_promo_redemptions_checkout_idx" ON "rayd8_promo_code_redemptions" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
CREATE INDEX "rayd8_promo_redemptions_promo_code_idx" ON "rayd8_promo_code_redemptions" USING btree ("promo_code_id");--> statement-breakpoint
CREATE INDEX "rayd8_promo_redemptions_user_idx" ON "rayd8_promo_code_redemptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rayd8_promo_redemptions_code_idx" ON "rayd8_promo_code_redemptions" USING btree ("code");--> statement-breakpoint
CREATE INDEX "rayd8_promo_redemptions_subscription_idx" ON "rayd8_promo_code_redemptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "rayd8_promo_redemptions_created_at_idx" ON "rayd8_promo_code_redemptions" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "rayd8_promo_codes_code_idx" ON "rayd8_promo_codes" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "rayd8_promo_codes_stripe_coupon_idx" ON "rayd8_promo_codes" USING btree ("stripe_coupon_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rayd8_promo_codes_stripe_promotion_code_idx" ON "rayd8_promo_codes" USING btree ("stripe_promotion_code_id");--> statement-breakpoint
CREATE INDEX "rayd8_promo_codes_active_idx" ON "rayd8_promo_codes" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "rayd8_promo_codes_sync_status_idx" ON "rayd8_promo_codes" USING btree ("stripe_sync_status");--> statement-breakpoint
CREATE INDEX "rayd8_promo_codes_applies_to_plan_idx" ON "rayd8_promo_codes" USING btree ("applies_to_plan");--> statement-breakpoint
CREATE INDEX "rayd8_promo_codes_created_at_idx" ON "rayd8_promo_codes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "rayd8_promo_codes_expires_at_idx" ON "rayd8_promo_codes" USING btree ("expires_at");