ALTER TABLE "users" ADD COLUMN "trial_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "trial_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "trial_hours_used" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "trial_notifications_sent" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "users" AS "u"
SET "trial_hours_used" = LEAST("usage"."calculated_hours", 35)
FROM (
	SELECT
		"user_id",
		(
			COALESCE(SUM("expansion_seconds"), 0)
			+ COALESCE(SUM("premium_seconds"), 0)
			+ COALESCE(SUM("regen_seconds"), 0)
		) / 3600.0 AS "calculated_hours"
	FROM "usage_periods"
	GROUP BY "user_id"
) AS "usage"
WHERE "u"."id" = "usage"."user_id"
  AND "u"."plan" = 'free';--> statement-breakpoint
UPDATE "users"
SET
	"trial_started_at" = NOW(),
	"trial_ends_at" = NOW() + INTERVAL '30 days'
WHERE "plan" = 'free'
  AND "trial_started_at" IS NULL;