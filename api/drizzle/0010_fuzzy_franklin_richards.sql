CREATE TYPE "public"."seo_action_type" AS ENUM('apply', 'rollback');--> statement-breakpoint
CREATE TYPE "public"."seo_report_status" AS ENUM('pending', 'complete', 'failed');--> statement-breakpoint
CREATE TYPE "public"."seo_route_type" AS ENUM('landing', 'conversion', 'support');--> statement-breakpoint
CREATE TABLE "seo_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_url" text NOT NULL,
	"action_type" "seo_action_type" NOT NULL,
	"before_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"after_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reasoning" text DEFAULT '' NOT NULL,
	"initiated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_scope" text DEFAULT 'full_site' NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"paths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"issues" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"initiated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "seo_report_status" DEFAULT 'pending' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"full_report_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"related_action_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_route_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path" text NOT NULL,
	"route_type" "seo_route_type" DEFAULT 'landing' NOT NULL,
	"priority" integer DEFAULT 50 NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"open_graph" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"index" boolean DEFAULT true NOT NULL,
	"follow" boolean DEFAULT true NOT NULL,
	"canonical_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "seo_actions" ADD CONSTRAINT "seo_actions_initiated_by_users_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_audits" ADD CONSTRAINT "seo_audits_initiated_by_users_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "seo_actions_page_url_idx" ON "seo_actions" USING btree ("page_url");--> statement-breakpoint
CREATE INDEX "seo_actions_action_type_idx" ON "seo_actions" USING btree ("action_type");--> statement-breakpoint
CREATE INDEX "seo_actions_created_at_idx" ON "seo_actions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "seo_audits_created_at_idx" ON "seo_audits" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "seo_audits_score_idx" ON "seo_audits" USING btree ("score");--> statement-breakpoint
CREATE INDEX "seo_reports_status_idx" ON "seo_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "seo_reports_created_at_idx" ON "seo_reports" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "seo_route_metadata_path_idx" ON "seo_route_metadata" USING btree ("path");--> statement-breakpoint
CREATE INDEX "seo_route_metadata_route_type_idx" ON "seo_route_metadata" USING btree ("route_type");--> statement-breakpoint
CREATE INDEX "seo_route_metadata_priority_idx" ON "seo_route_metadata" USING btree ("priority");