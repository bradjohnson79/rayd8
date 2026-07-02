UPDATE "users"
SET "normalized_email" = lower(trim("email"))
WHERE "normalized_email" IS NULL;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT "normalized_email", count(*) AS "count"
      FROM "users"
      GROUP BY "normalized_email"
      HAVING count(*) > 1
    ) AS "duplicates"
  ) THEN
    RAISE EXCEPTION 'Duplicate normalized user emails exist. Run npm run audit:billing-dedup -- --mode=pre-migration and resolve manually before applying normalized-email enforcement.';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "normalized_email" SET NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "users_normalized_email_lookup_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "users_normalized_email_idx" ON "users" USING btree ("normalized_email");
