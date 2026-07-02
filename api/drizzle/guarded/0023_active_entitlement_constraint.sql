-- Guarded future migration artifact.
-- Do not add this file to drizzle/meta/_journal.json until every precondition below returns zero rows
-- and each affected billing conflict has explicit manual remediation approval.

-- PRECONDITION: must return zero rows.
SELECT
  "user_id",
  count(*) AS "active_entitlement_rows"
FROM "subscriptions"
WHERE "plan" IN ('regen', 'amrita')
  AND "status" IN ('active', 'trialing', 'past_due')
GROUP BY "user_id"
HAVING count(*) > 1;

-- FINAL ENFORCEMENT: apply only after the precondition returns zero rows.
CREATE UNIQUE INDEX "subscriptions_one_current_paid_entitlement_idx"
  ON "subscriptions" USING btree ("user_id")
  WHERE "plan" IN ('regen', 'amrita')
    AND "status" IN ('active', 'trialing', 'past_due');
