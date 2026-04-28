CREATE TYPE "public"."cancellation_reason" AS ENUM('too_expensive', 'not_using_enough', 'technical_issues', 'didnt_see_results', 'found_alternative', 'other');--> statement-breakpoint
CREATE TABLE "subscription_cancellation_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"custom_message" text,
	"current_period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "cancel_at_period_end" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_cancellation_feedback" ADD CONSTRAINT "subscription_cancellation_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_cancellation_feedback" ADD CONSTRAINT "subscription_cancellation_feedback_stripe_subscription_id_subscriptions_stripe_subscription_id_fk" FOREIGN KEY ("stripe_subscription_id") REFERENCES "public"."subscriptions"("stripe_subscription_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscription_cancellation_feedback_user_idx" ON "subscription_cancellation_feedback" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscription_cancellation_feedback_subscription_idx" ON "subscription_cancellation_feedback" USING btree ("stripe_subscription_id");