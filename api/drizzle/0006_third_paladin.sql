CREATE TYPE "public"."usage_period_type" AS ENUM('lifetime', 'billing_cycle');--> statement-breakpoint
CREATE TABLE "usage_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"period_type" "usage_period_type" NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"expansion_seconds" integer DEFAULT 0 NOT NULL,
	"premium_seconds" integer DEFAULT 0 NOT NULL,
	"regen_seconds" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usage_sessions" ADD COLUMN "seconds_watched" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "usage_periods" ADD CONSTRAINT "usage_periods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "usage_periods_user_period_idx" ON "usage_periods" USING btree ("user_id","period_type","period_start");