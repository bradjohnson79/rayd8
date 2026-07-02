# Account + Subscription Dedup Release Gate

Date: 2026-07-01

## Status

Not production ready.

The database used by the API smoke suite is production, still pre-migration, and contains existing subscription conflicts that block final active-entitlement enforcement.

## Migration Target

- Environment checked: API smoke-suite database from `api/drizzle.config.ts`, loaded from repo root `.env`.
- Environment classification: production.
- Neon project: `rayd8.app` (`curly-river-66984260`).
- Neon branch: `production` (`br-dark-tooth-akeka7zu`), primary/default.
- Neon endpoint: `ep-crimson-breeze-akbt83bj`.
- Database host: `ep-crimson-breeze-akbt83bj-pooler.c-3.us-west-2.aws.neon.tech`
- Database name: `neondb`
- Current Drizzle migration state: `drizzle.__drizzle_migrations` latest id `19`.
- Pending local migrations: `0020_free_trial_integrity`, `0021_account_subscription_dedup`, `0022_normalized_email_enforcement`.

## Preflight Results

Preflight duplicate normalized-email check passed:

- `duplicate_normalized_email`: 0

Preflight billing conflict checks failed:

- Users with multiple Stripe Customers: 13
- Stripe Customers shared by multiple users: 0
- Users with multiple active/manageable paid subscription rows: 5

Raw conflict report preserved privately at:

- `private-reports/release-gate/preflight_subscription_conflicts.raw.json`

Committed redacted summary:

- `docs/release-gate/blocked_users_redacted.md`

The blocking rows include overlapping active/manageable subscription states. Per release-gate rules, no accounts were merged, no users were deleted, no Stripe customer mappings were overwritten, and no active subscriptions were canceled automatically.

## Migration Application

Migration was not applied.

Reason: the previous unsplit migration would have attempted final active-entitlement enforcement while the production database has existing overlapping active/manageable paid subscription rows. The migration has now been split into safe expansion, normalized-email enforcement, and a guarded future constraint artifact.

Required manual remediation before retry:

- Review each user in the private raw report and remediation manifest.
- Decide which Stripe subscription lifecycle is canonical for each user.
- Resolve incomplete/duplicate subscription rows and multiple Stripe customer mappings with explicit approval.
- Rerun preflight checks.
- Apply safe expansion/email migrations only after confirming the target and duplicate-email preflight.
- Apply the guarded active-entitlement constraint only after overlapping active/manageable rows are resolved.

## Verification Results

Full API suite including DB smoke tests:

- Failed: 18 test files passed, 1 failed.
- Failed tests: 5 DB smoke tests in `src/services/notifications/notifications.smoke.test.ts`.
- Root cause: target DB does not yet have `users.normalized_email`, so smoke-test inserts using the new schema fail with Postgres error `42703`.

Previously verified before this release-gate pass:

- API typecheck passed.
- API non-smoke tests passed.
- Targeted billing tests passed.
- Web TypeScript check passed.
- Touched web files lint clean.

These do not satisfy the final release gate because the full API suite including DB smoke tests does not pass.

## Stripe Test-Mode E2E Validation

Not run.

Reason: the required test/staging database migration is blocked. Running app-level Stripe test-mode E2E against a schema-mismatched API would not validate the release candidate and would produce false failures.

Scenarios still pending:

- New normalized local account creation.
- Case/whitespace duplicate prevention.
- One Stripe Customer on first paid checkout.
- Double-click/two-tab Checkout reuse or safe block.
- Direct REGEN to AMRITA subscription upgrade.
- Period-end AMRITA to REGEN downgrade.
- Canceled historical subscriber resubscribe with customer reuse.
- `past_due` grace and non-resetting grace clock.
- `unpaid` entitlement removal and billing recovery routing.
- Duplicate webhook replay idempotency.
- Stale webhook event protection.

## Existing Data Audit

`npm run audit:billing-dedup` previously failed because the target DB was pre-migration and the audit assumed `users.normalized_email`.

The audit has been split into:

- `npm run audit:billing-dedup -- --mode=pre-migration`
- `npm run audit:billing-dedup -- --mode=post-migration`

The preflight report currently classifies the target DB as:

- Duplicate local account: none found by normalized-email preflight.
- Multiple Stripe customers for one local user: manual remediation required.
- Multiple local users for one Stripe customer: none found by preflight.
- Subscription/entitlement mismatch: manual remediation required for overlapping active/manageable paid rows.
- Historical canceled subscription: must be classified from the new pre-migration audit and private remediation manifest.

## Required Before Production Readiness

- Manually remediate the reported subscription/customer conflicts with explicit approval.
- Apply safe pending migrations successfully to the production database only through the approved deployment process.
- Verify `drizzle.__drizzle_migrations` records `0021_account_subscription_dedup`.
- Verify:
  - `users.normalized_email`
  - `users.stripe_customer_id`
  - unique normalized-email index
  - unique non-null Stripe customer mapping index
  - `billing_checkout_attempts`
  - `stripe_events` claim/status fields
- Rerun and pass the full API suite including DB smoke tests.
- Run and pass all Stripe test-mode E2E scenarios.
- Run `npm run audit:billing-dedup` successfully and preserve the final classified report.

## Invariant Confirmation

Not confirmed for release.

- One normalized email maps to one RAYD8 identity: code implemented, DB migration not applied.
- One RAYD8 identity maps to one Stripe customer: code implemented, existing data conflicts remain.
- One active paid entitlement exists at a time: code implemented, DB unique index not applied due existing conflicts.
- `users.plan` is cached metadata only: code implemented, not fully validated in migrated smoke DB.
- `subscriptionState` is entitlement authority: code implemented, not fully validated in migrated smoke DB.
- No duplicate active REGEN + AMRITA subscriptions are possible: not confirmed because migration is blocked by existing overlapping paid rows.
- No checkout path creates customers via `customer_email`: code implemented, not E2E validated.
- Webhook events are idempotent and stale-event safe: code implemented, not E2E validated against migrated DB.
