ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "pause_started_at" timestamptz;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "pause_resumes_at" timestamptz;
