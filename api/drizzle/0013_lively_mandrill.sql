CREATE TYPE "public"."affiliate_commission_status" AS ENUM('pending', 'approved', 'paid');--> statement-breakpoint
CREATE TABLE "affiliate_commissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_user_id" text NOT NULL,
	"referred_user_id" text NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"amount_usd" integer DEFAULT 600 NOT NULL,
	"status" "affiliate_commission_status" DEFAULT 'pending' NOT NULL,
	"source" text DEFAULT 'stripe_invoice' NOT NULL,
	"event_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "referral_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referral_code" text NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "referral_code" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "referred_by_user_id" text;--> statement-breakpoint
WITH ranked_users AS (
	SELECT
		"id",
		UPPER(LPAD(TO_HEX(ROW_NUMBER() OVER (ORDER BY "created_at", "id")), 8, '0')) AS "referral_code"
	FROM "users"
)
UPDATE "users"
SET "referral_code" = ranked_users."referral_code"
FROM ranked_users
WHERE "users"."id" = ranked_users."id"
  AND "users"."referral_code" IS NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "referral_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_affiliate_user_id_users_id_fk" FOREIGN KEY ("affiliate_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_referred_user_id_users_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_commissions_subscription_idx" ON "affiliate_commissions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_commissions_affiliate_referred_idx" ON "affiliate_commissions" USING btree ("affiliate_user_id","referred_user_id");--> statement-breakpoint
CREATE INDEX "affiliate_commissions_affiliate_user_idx" ON "affiliate_commissions" USING btree ("affiliate_user_id");--> statement-breakpoint
CREATE INDEX "affiliate_commissions_referred_user_idx" ON "affiliate_commissions" USING btree ("referred_user_id");--> statement-breakpoint
CREATE INDEX "affiliate_commissions_status_idx" ON "affiliate_commissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "affiliate_commissions_created_at_idx" ON "affiliate_commissions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "referral_sessions_referral_code_idx" ON "referral_sessions" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX "referral_sessions_created_at_idx" ON "referral_sessions" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_user_id_users_id_fk" FOREIGN KEY ("referred_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_referral_code_idx" ON "users" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX "users_referred_by_user_id_idx" ON "users" USING btree ("referred_by_user_id");