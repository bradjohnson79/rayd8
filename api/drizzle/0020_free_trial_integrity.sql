UPDATE "users"
SET
  "trial_started_at" = "created_at",
  "trial_ends_at" = "created_at" + INTERVAL '30 days'
WHERE "plan" = 'free'
  AND (
    "trial_started_at" IS NULL
    OR "trial_ends_at" IS NULL
    OR "trial_started_at" > "created_at" + INTERVAL '5 minutes'
  );--> statement-breakpoint
UPDATE "users"
SET "trial_ends_at" = "trial_started_at" + INTERVAL '30 days'
WHERE "plan" = 'free'
  AND "trial_started_at" IS NOT NULL
  AND "trial_ends_at" > "trial_started_at" + INTERVAL '30 days';--> statement-breakpoint
WITH "free_usage_totals" AS (
  SELECT
    "u"."id" AS "user_id",
    "u"."created_at",
    COALESCE(SUM("p"."expansion_seconds"), 0)::integer AS "expansion_seconds",
    COALESCE(SUM("p"."premium_seconds"), 0)::integer AS "premium_seconds",
    COALESCE(SUM("p"."regen_seconds"), 0)::integer AS "regen_seconds"
  FROM "users" AS "u"
  LEFT JOIN "usage_periods" AS "p"
    ON "p"."user_id" = "u"."id"
  WHERE "u"."plan" = 'free'
  GROUP BY "u"."id", "u"."created_at"
)
INSERT INTO "usage_periods" (
  "user_id",
  "period_type",
  "period_start",
  "period_end",
  "expansion_seconds",
  "premium_seconds",
  "regen_seconds"
)
SELECT
  "user_id",
  'lifetime'::"usage_period_type",
  "created_at",
  '9999-12-31 23:59:59.999+00'::timestamptz,
  "expansion_seconds",
  "premium_seconds",
  "regen_seconds"
FROM "free_usage_totals"
ON CONFLICT ("user_id", "period_type", "period_start")
DO UPDATE SET
  "period_end" = EXCLUDED."period_end",
  "expansion_seconds" = EXCLUDED."expansion_seconds",
  "premium_seconds" = EXCLUDED."premium_seconds",
  "regen_seconds" = EXCLUDED."regen_seconds";--> statement-breakpoint
DELETE FROM "usage_periods" AS "p"
USING "users" AS "u"
WHERE "p"."user_id" = "u"."id"
  AND "u"."plan" = 'free'
  AND NOT (
    "p"."period_type" = 'lifetime'
    AND "p"."period_start" = "u"."created_at"
  );--> statement-breakpoint
UPDATE "users" AS "u"
SET "trial_hours_used" = LEAST(
  35,
  GREATEST(
    "u"."trial_hours_used",
    (
      COALESCE("p"."expansion_seconds", 0)
      + COALESCE("p"."premium_seconds", 0)
      + COALESCE("p"."regen_seconds", 0)
    ) / 3600.0
  )
)
FROM "usage_periods" AS "p"
WHERE "u"."id" = "p"."user_id"
  AND "u"."plan" = 'free'
  AND "p"."period_type" = 'lifetime'
  AND "p"."period_start" = "u"."created_at";
