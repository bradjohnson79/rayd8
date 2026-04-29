CREATE TABLE "archived_admin_orders" (
	"stripe_subscription_id" text PRIMARY KEY NOT NULL,
	"archived_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_by" text
);
--> statement-breakpoint
ALTER TABLE "archived_admin_orders" ADD CONSTRAINT "archived_admin_orders_stripe_subscription_id_subscriptions_stripe_subscription_id_fk" FOREIGN KEY ("stripe_subscription_id") REFERENCES "public"."subscriptions"("stripe_subscription_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "archived_admin_orders_archived_at_idx" ON "archived_admin_orders" USING btree ("archived_at");