CREATE TYPE "public"."notification_recipient_type" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'sent', 'failed', 'skipped_duplicate', 'dry_run');--> statement-breakpoint
CREATE TABLE "notification_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"enabled_events" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"admin_recipients_override" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event" text NOT NULL,
	"entity_id" text NOT NULL,
	"user_id" text,
	"recipient" text NOT NULL,
	"type" "notification_recipient_type" NOT NULL,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"error" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications_log" ADD CONSTRAINT "notifications_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_log_event_idx" ON "notifications_log" USING btree ("event");--> statement-breakpoint
CREATE INDEX "notifications_log_entity_id_idx" ON "notifications_log" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "notifications_log_status_idx" ON "notifications_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notifications_log_event_entity_recipient_idx" ON "notifications_log" USING btree ("event","entity_id","recipient","type");