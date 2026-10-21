# RAYD8 reliability certification

Date: 2026-10-21
Production commit: `1b1440b4c436275bf22e16cb8ec6be2b37665b9a`
Audit branch: `audit/schemathesis-reliability` (local only, not pushed, not merged)
Schemathesis: `4.7.3`
Peer review: Kimi Code 2.7 is not available in this environment. No substitute model was used.

## A. Executive summary

Stage 1, the Amrita checkout eligibility repair, is deployed on `main` and answering production traffic. Stage 2 added a pinned Schemathesis runner and an accurate four-operation contract, then executed it only against an isolated local API with Stripe, Clerk, and database credentials forced empty.

Verdict: **CONDITIONAL GO**.

The known checkout blocker is repaired in production. This audit does not certify the whole platform. Browser playback, stateful billing sequences, and the remaining API surface were not executed here, so this is not a FULL GO.

| Item | Result |
| --- | --- |
| Route declarations on `main` | 78 |
| Mounted paths | 86. Admin users and admin affiliates are each mounted under `/api` and `/v1`. |
| Operations in the OpenAPI subset | 4 |
| Operations Schemathesis executed | 4 of 4 in that subset |
| Generated cases | 62 passed, 24 skipped |
| HTTP 500 responses in the cassette | 0 |
| Subscription regression tests | 30 passed |
| Confirmed defects repaired in Stage 2 | 0 |
| Unresolved platform coverage | The other 82 mounted paths, Playwright, and stateful Stripe sequences |

The 24 skipped cases are the Examples phase. The subset schema has no example values, so Schemathesis skipped that phase and ran Coverage and Fuzzing.

## B. Subscription audit

The production API is `https://rayd8-api.onrender.com`, Render deploy `dep-dbcgr82vcj2c738ns3pg`, commit `1b1440b`, status live.

Non-destructive production checks:

- `GET /health` returned `{"ok":true,"service":"rayd8-api"}`.
- `POST /v1/billing/checkout` with `{"plan":"amrita"}` and no session returned HTTP 401 `AUTH_REQUIRED`. No Checkout Session was created.

`m.hauwert1@quicknet.nl` remains on plan `free` with one `incomplete_expired` Amrita subscription and no collected payment. She was not charged and her account was not modified. The deployed gate treats `incomplete_expired` and a canceled subscription without remaining entitlement as eligible for a new checkout. She can be contacted to retry the purchase herself. Amrita access is not restored until that payment succeeds.

The same code path covers the 68 free accounts whose only subscription rows are canceled or `incomplete_expired`. No rows were rewritten. The 78 REGEN-plan accounts with no subscription row were not changed. The six past-due accounts remain inside the seven-day grace policy. The complimentary Amrita test rows were not changed.

Local regression on this commit, using a fake `sk_test` value and mocked Stripe:

- An expired incomplete subscription opens a new Checkout Session and does not update, cancel, or void the old subscription.
- A canceled subscription opens a new Checkout Session.
- An active subscription and a past-due subscription inside grace reject a duplicate purchase before Stripe is called.
- An `active` event activates entitlement. An `incomplete` event does not.
- A repeated Stripe event is ignored after the first claim.

No live Stripe test charge was run. The configured local key is a live key, and this audit refused to use it.

## C. Global Player audit

The forbidden playback strings are absent from `web/src` on `main`:

- Tap To Start Playback
- Playback Paused
- Your browser needs one more tap
- Resume Session

There is no Playwright configuration in this repository. Desktop and mobile browser runs were not executed. Player initialization, audio, fullscreen, and entitlement gating are not certified by this pass.

## D. Code on the audit branch

No application behavior was changed. The branch adds:

- `api/requirements-schemathesis.txt` pins Schemathesis 4.7.3.
- `api/openapi/reliability-subset.yaml` describes four operations as they behave with credentials removed.
- `api/scripts/run-schemathesis-isolated.sh` refuses `onrender.com`, `rayd8.app`, and `vercel.app`, and refuses to start when a Stripe secret or database URL is already set.

The webhook response in this runner is HTTP 503, `Stripe webhook configuration is missing on the server.` That is the safe result of removing credentials. `not_a_server_error` is excluded only for that documented response. `status_code_conformance` still requires 503. The cassette contains no HTTP 500.

Schemathesis warned that checkout returned 404 and that its data was rejected. The 404 responses are TRACE, PUT, PATCH, GET, and DELETE against the POST-only checkout route. Fastify correctly reports those methods as not found. POST without a session returns 401 before checkout creation. The schema-mismatch warning is the same authentication-first behavior: invalid bodies do not reach subscription logic.

## E. Testing levels

1. Local development. Run the isolated script against `127.0.0.1:3099` with credentials unset. Run the subscription vitest files for billing changes.
2. Pull request. Run the same isolated Schemathesis command and the existing API tests. Do not point the fuzzer at a shared database.
3. Pre-production. Expand the OpenAPI file from the route inventory before a major release, then add Playwright once a config exists. Keep any soak at or below 20 minutes.
4. Production smoke. `GET /health` and an unauthenticated checkout POST that must return 401. No fuzzing, no authenticated billing sequence, and no webhook replay.

## F. What remains

- Authenticated, stateful, and admin routes are outside the contract subset.
- Renewal, cancellation, and repurchase sequences beyond the mocked vitest file were not executed against Stripe.
- Render and Vercel environment parity was not re-audited beyond the live API health and checkout rejection.
- This branch must not be merged until those gaps are either tested or explicitly accepted.
