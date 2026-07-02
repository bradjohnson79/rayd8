# Migration Split Report

Date: 2026-07-01

## Why The Split Was Required

The previous `0021_account_subscription_dedup` migration mixed safe schema expansion, data backfill, customer mapping inference, and final active-entitlement enforcement. Production preflight showed existing overlapping subscription rows, so applying that migration as-is would either fail or require unsafe automatic billing decisions.

## Current Migration Chain

- `0020_free_trial_integrity`: unchanged pending free-trial integrity migration.
- `0021_account_subscription_dedup`: safe additive billing/account expansion only.
- `0022_normalized_email_enforcement`: normalized-email backfill and unique enforcement, guarded by duplicate preflight.

## Guarded Future Artifact

- `api/drizzle/guarded/0023_active_entitlement_constraint.sql`

This file is not registered in `api/drizzle/meta/_journal.json`. It must be applied only after approved remediation and zero-conflict preflight.

## Not Included In Default Migrations

- Partial unique active-entitlement index.
- Automatic Stripe customer mapping backfill.
- Automatic subscription cancellation.
- Automatic user/account merge.
- Automatic Stripe customer reassignment.

## Required Before Applying Guarded Constraint

The precondition query in `0023_active_entitlement_constraint.sql` must return zero rows, and the post-migration audit must show:

- Zero unresolved multiple-customer cases.
- Zero overlapping active/manageable paid subscriptions.
- Zero shared Stripe customer ownership cases.
- Zero unresolved billing conflict flags.
