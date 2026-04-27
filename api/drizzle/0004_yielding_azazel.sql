ALTER TYPE "public"."experience" ADD VALUE 'regen';--> statement-breakpoint
ALTER TYPE "public"."plan" ADD VALUE 'amrita';--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "current_period_start" timestamp with time zone;