# Blocked Billing Users Redacted Summary

Date: 2026-07-01

Raw identifiers are stored only in `private-reports/release-gate/`.

## Aggregate Counts

- Duplicate normalized emails: 0
- Users with multiple historical Stripe Customers: 13
- Users with overlapping active/manageable paid subscription rows: 5
- Stripe Customers shared across multiple RAYD8 users: 0

## Overlapping Subscription Cases

| Alias | Local Shape | Classification | Action |
| --- | --- | --- | --- |
| billing-conflict-user-001 | two active REGEN rows across different Stripe Customers | manual remediation required | approve canonical customer/subscription before final constraint |
| billing-conflict-user-002 | active AMRITA row plus incomplete AMRITA row across different Stripe Customers | manual remediation required | verify Stripe truth and preserve valid paid access |
| billing-conflict-user-003 | active AMRITA row plus incomplete REGEN row across different Stripe Customers | manual remediation required | verify Stripe truth and preserve valid paid access |
| billing-conflict-user-004 | active AMRITA row plus incomplete AMRITA row across different Stripe Customers | manual remediation required | verify Stripe truth and preserve valid paid access |
| billing-conflict-user-005 | active AMRITA row plus incomplete AMRITA row across different Stripe Customers | manual remediation required | verify Stripe truth and preserve valid paid access |

## Release Gate

The active-entitlement unique constraint must not be applied until every row above has explicit approval and the guarded precondition query returns zero rows.
