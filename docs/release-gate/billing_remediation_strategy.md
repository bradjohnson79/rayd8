# Billing Remediation Strategy

Date: 2026-07-01

## Environment Classification

Root `.env` currently points to:

- Neon organization: `Brad Johnson`
- Neon project: `rayd8.app`
- Project ID: `curly-river-66984260`
- Branch: `production`
- Branch ID: `br-dark-tooth-akeka7zu`
- Endpoint: `ep-crimson-breeze-akbt83bj`
- Database: `neondb`
- Environment classification: production

This is not local, development, or staging. No writes, Stripe mutations, account merges, customer reassignments, subscription cancellations, or entitlement revocations were performed.

## Evidence Safety

Raw reports containing emails and Stripe IDs were moved to:

- `private-reports/release-gate/`

That directory is gitignored. Committed documentation must contain only aggregate counts and redacted aliases.

## Staged Migration Strategy

### Stage A: Safe Expansion

Migration: `api/drizzle/0021_account_subscription_dedup.sql`

Contains only additive/non-enforcing changes:

- Nullable `users.normalized_email`
- Nullable `users.stripe_customer_id`
- `users.billing_conflict_review_required`
- Subscription transition fields used by `subscriptionState`
- Webhook claim/status fields
- `billing_checkout_attempts`
- Non-enforcing lookup/performance indexes

It does not contain:

- Active-entitlement partial unique index
- Normalized-email non-null enforcement
- Stripe customer mapping backfill
- Account merge
- Subscription cancellation
- Stripe customer reassignment

### Stage B: Email Backfill And Unique Enforcement

Migration: `api/drizzle/0022_normalized_email_enforcement.sql`

This migration:

- Backfills `users.normalized_email = lower(trim(email))`
- Fails if duplicate normalized emails exist
- Sets `normalized_email` non-null
- Adds the unique normalized-email index

Preflight has shown zero duplicate normalized emails for the current production target, but this query must be rerun immediately before applying the migration.

### Stage C: Deferred Billing Constraint

Guarded artifact: `api/drizzle/guarded/0023_active_entitlement_constraint.sql`

This is intentionally outside the default Drizzle migration chain. It must not be applied until the precondition query returns zero rows and all manual remediation cases have explicit approval.

Required clean state:

- Zero unresolved multiple-customer cases
- Zero overlapping active/manageable paid subscription cases
- Zero shared Stripe customer ownership cases
- Zero unresolved `billing_conflict_review_required` flags

## Temporary Conflict Containment

Affected accounts are contained by dynamic conflict detection and the internal `billing_conflict_review_required` flag.

Until manually reconciled:

- Preserve the highest currently valid paid access.
- Do not silently downgrade or revoke paid access.
- Block new checkout, upgrade, downgrade, and duplicate subscription actions.
- Route the account to support/billing resolution.
- Leave unaffected users on normal billing flows.

## Manual Remediation Workflow

Every affected case requires explicit approval. There is no bulk fix.

Each approval must include:

- Local user ID
- Approved canonical Stripe Customer ID
- Approved canonical Stripe Subscription ID, if applicable
- Intended final RAYD8 entitlement
- Approved Stripe-side action, if any
- Reviewer identity
- Timestamp
- Notes/reasoning

Required workflow:

1. Generate the private manifest with `npm run billing:remediation:plan`.
2. Review one case at a time.
3. Re-fetch Stripe truth before approval.
4. Record approval details outside the codebase or in a private gitignored report.
5. Perform approved Stripe-side actions separately from local-record repair.
6. Preserve historical subscriptions and customer records.
7. Do not delete history and do not falsify Stripe status fields.
8. Mark superseded local relationships with explicit reconciliation metadata only when approved.
9. Re-fetch Stripe truth after remediation.
10. Recompute subscription state.
11. Verify one canonical RAYD8 billing identity.
12. Verify one current paid entitlement.
13. Verify duplicate checkout cannot be created.

## Read-Only Commands

Pre-migration audit:

```bash
npm run audit:billing-dedup -- --mode=pre-migration
```

Post-migration audit:

```bash
npm run audit:billing-dedup -- --mode=post-migration
```

Private remediation manifest:

```bash
npm run billing:remediation:plan
```

All three commands are read-only. The manifest writes raw billing identifiers only under `private-reports/`.
