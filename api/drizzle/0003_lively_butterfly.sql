CREATE TYPE "public"."experience" AS ENUM('expansion', 'premium');--> statement-breakpoint
ALTER TABLE "usage_sessions" ADD COLUMN "experience" "experience" DEFAULT 'expansion' NOT NULL;--> statement-breakpoint
ALTER TABLE "usage_sessions" ADD COLUMN "last_heartbeat" timestamp with time zone DEFAULT now() NOT NULL;