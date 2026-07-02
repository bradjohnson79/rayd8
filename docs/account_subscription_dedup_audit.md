# Account And Subscription Dedup Audit

## Summary

The Phase 1 audit found that RAYD8 identity and billing were mostly centralized, but several flows could still create duplicate local accounts, multiple Stripe Customers, or overlapping paid subscriptions for the same person. The repair now treats Clerk user ID as the primary identity key, normalized email as the duplicate-prevention key, `users.stripe_customer_id` as the one-customer mapping, and subscription state as the entitlement authority.

## Findings Preserved

- Auth identity used Clerk as the source of truth, but local `users.email` uniqueness was case-sensitive and account sync could relink by raw email without normalized conflict checks.
- Stripe Checkout relied on `customer_email` when no subscription already existed, which allowed Stripe to create multiple Customers for repeated or parallel checkout attempts.
- Checkout and success-page verification had no durable pending-attempt record or deterministic Stripe idempotency key.
- Webhook idempotency used a processed-event row, but the old row shape could not represent processing, failed, retryable, or stale leased events.
- Entitlements were partly inferred from cached `users.plan`, and `past_due` / `unpaid` states were previously too broad for paid access decisions.
- Billing UI had duplicate-click guards, but some flows reset the guard before redirect handoff and sidebar AMRITA upgrade items dropped their target plan.
- Customer Portal access existed for active subscriptions, but unpaid recovery needed explicit routing to portal instead of new checkout.

## Repair Invariants

- One canonical RAYD8 account per normalized email.
- One Stripe Customer per RAYD8 user, with conflicts reported for manual review.
- One current paid subscription entitlement per user.
- `users.plan` is cached metadata only; subscription state decides entitlement.
- `past_due` keeps access only inside a non-resetting 7-day grace window.
- `unpaid`, `paused`, `canceled`, `incomplete`, and `incomplete_expired` remove paid access immediately.
- Webhook events are claimable, retryable, and completed only after handlers finish.
- Existing-data repair stays dry-run by default and refuses unsafe automatic merges.
