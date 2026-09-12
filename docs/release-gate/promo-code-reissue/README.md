# Promo Code Exhaustion: Root Cause & Repair

**Branch:** `fix/promo-code-exhaustion-reissue`
**Baseline commit:** `3bb647a`
**Date:** 2026-09-12
**Status:** Repaired, reissued in production, verified

---

## 1. Reported symptom

A member reported that promo code `REGEN1MONTH` was rejected at Stripe Checkout with
**"This promotion code is invalid."**

Confusingly, the Admin → Promo Codes console showed the code as:

- present in the list
- `SYNCED` status
- `Expires: No expiration`

So the code looked healthy while being unusable.

## 2. Root cause

`REGEN1MONTH` is **not** an expiry problem. It is a **redemption-cap exhaustion** problem.

The code was created as a **single-use** code (`max_redemptions = 1`). Its one allowed
redemption was consumed on **2026-08-30** by `1936034135@qq.com`.

Stripe's documented behavior when a coupon's cap is reached:

> If the underlying coupon for a promotion code becomes invalid, all of its promotion
> codes become permanently inactive. Similarly, if a promotion code reaches its
> `max_redemptions` or `expires_at`, it becomes permanently inactive. **These promotion
> codes can't be reactivated.**

Two compounding restrictions make this unrecoverable in place:

1. Stripe **cannot raise** an existing coupon's `max_redemptions` (only `metadata` and
   `name` are editable).
2. An exhausted promotion code **cannot be reactivated**, even by setting `active: true`.

So the second customer (`renovace.elpetr@gmail.com`) was correctly rejected — they were
trying to use a one-person code for the second person.

### Evidence (live Stripe + database)

| Object | Field | Value |
| --- | --- | --- |
| Promotion code `promo_1U8nt5GPXfP6Qy0mUafRop6k` | `active` | `false` |
| | `expires_at` | `null` |
| | `max_redemptions` | `1` |
| | `times_redeemed` | `1` |
| Coupon `uZXag4J0` | `valid` | `false` |
| | `max_redemptions` / `times_redeemed` | `1` / `1` |
| `rayd8_promo_codes` row | `stripe_sync_status` | `synced` ← stale |
| | `is_active` | `true` ← stale |
| | `times_redeemed` | `1` |
| `rayd8_promo_code_redemptions` | rows for `REGEN1MONTH` | `1` (`status: applied`) |

Full capture: [`artifacts/00-baseline-evidence.json`](artifacts/00-baseline-evidence.json).

## 3. Why the admin console looked healthy

Four distinct defects hid the failure:

1. **Stale sync status.** The list renders `stripe_sync_status`, last written *before* the
   redemption. `recordPromoCodeRedemption` only refreshed `times_redeemed`, never
   re-derived `stripe_sync_status` or `is_active` — so the exhausted code still read
   `SYNCED` while `is_active` stayed `true`.
2. **No cap shown.** The table showed "Recorded redemptions" (`1`) but never the cap, so
   `1 of 1` was visually identical to `1 of 1000`.
3. **"No expiration" is true but irrelevant.** It reflects `expires_at` only and says
   nothing about the redemption cap.
4. **Exhaustion was only detectable on demand.** The validator did detect
   `!promotionCode.active` → `inactive` with "Stripe promotion code is inactive.", but it
   only ran when an admin clicked **Validate**.

## 4. Repair

### 4.1 Truthful status (backend)

- Added `isPromoCodeExhausted()` — a single source of truth for `used >= cap`
  (with `cap == null` meaning unlimited).
- Every serialized record now carries derived, presentation-ready fields:
  `is_exhausted`, `display_status` (`exhausted` | `archived` | sync status), and
  `remaining_redemptions`.
- `listPromoCodes` gained an `exhausted` filter and an `exhausted` summary count, and an
  exhausted code is **excluded from the `active` count** even though its stored
  `is_active` is still `true`.
- `validatePromoCodeWithStripe` now reports the cap explicitly and flags an invalid
  underlying coupon.

### 4.2 Stop writing stale status (backend)

`recordPromoCodeRedemption` now re-derives state when the cap is consumed, flipping
`is_active → false`, `stripe_sync_status → inactive`, and recording an explanatory
`stripe_sync_error`. The list can no longer report a dead code as healthy.

No schema change was required — exhaustion is derived from existing
`max_redemptions` / redemption rows.

### 4.3 Reissue (backend + CLI)

Stripe offers exactly one supported recovery: **mint a new coupon + promotion code**.
Added `reissuePromoCode(id, { maxRedemptions })`:

- retires the dead Stripe promotion code (best-effort, never blocking)
- creates a **fresh coupon** with the requested cap
- creates a **fresh promotion code reusing the same code text**, so customers are unaffected
- fails fast if the new cap is not above already-recorded redemptions
- preserves local redemption history
- cleans up orphaned Stripe objects on failure

Exposed via:

- `POST /api/admin/promo-codes/:id/reissue`
- `npm run promos:reissue -- --code=<CODE> [--unlimited | --max-redemptions=N] [--apply]`
  (dry-run by default)

### 4.4 Admin console (frontend)

- `display_status` drives the badge; `exhausted` gets its own orange treatment
- New **Redemptions (used / cap)** column with `N remaining`
- Inline warning on exhausted rows: *"Cap reached. Stripe rejected this code at
  checkout; reissue to restore it."*
- New **Exhausted** summary card and status filter
- Context-aware **Reissue** action (prompts for a cap or `UNLIMITED`)
- Detail panel explains exhaustion and surfaces `stripe_sync_error`
- Create-form help text now states the cap cannot be raised later

## 5. Production reissue performed

```
npm run promos:reissue -- --code=REGEN1MONTH --unlimited --apply
```

| | Before | After |
| --- | --- | --- |
| Coupon | `uZXag4J0` (`valid: false`) | `veRSYNxh` (`valid: true`) |
| Promotion code | `promo_1U8nt5GPXfP6Qy0mUafRop6k` (`active: false`) | `promo_1UEtV7GPXfP6Qy0mBbVEFhVI` (`active: true`) |
| Cap | `1` | `null` (unlimited) |
| `times_redeemed` | `1` | `0` |
| Code text | `REGEN1MONTH` | `REGEN1MONTH` (unchanged) |
| Local redemption rows | `1` | `1` (preserved) |

Verified directly against Stripe live, including that the new promotion code is linked to
the valid coupon via `promotion.coupon`.
Full capture: [`artifacts/01-post-reissue-verification.json`](artifacts/01-post-reissue-verification.json).

**Impact:** customers still enter `REGEN1MONTH`, which now grants 100% off for one billing
cycle with no cap. The existing subscriber keeps their original discount; no subscription
was altered.

## 6. Verification

- `api` typecheck: clean
- `web` typecheck: clean
- `npm run test:promo-code-exhaustion`: 14 passing (7 new + 7 pre-existing)
- Full API suite: 199 passing, 1 pre-existing failure from a stale gitignored
  `dist/` artifact (`dist/services/player/usageTracking.end.idempotency.test.js`,
  built 2026-08-13). The equivalent source test passes.

## 7. Follow-up

- The reissued code is unlimited by request. If `REGEN1MONTH` is intended as a one-per-person
  grant, prefer a much higher cap with a customer-restricted promotion code rather than
  `max_redemptions = 1`.
- Audit other codes with a low `max_redemptions` against `times_redeemed` to catch
  near-exhaustion before customers hit it. The new **Exhausted** filter makes this a
  one-click check.

## 8. Deploy status

Merged to `main` and pushed (`f4dfa09`, then `3087351` for a JSX build fix, then `46a4351`).

| Surface | Commit | Status |
| --- | --- | --- |
| Stripe (production) | — | **Live.** Reissue already applied and verified. |
| Web (Vercel `rayd8-web`) | `3087351` | **Live.** `PromoCodes-BjrTfA5x.js` serves the exhausted badge, used/cap column, and Reissue action. |
| API (Render `rayd8-api`) | `46a4351` | **Live** (deploy `dep-daiu9boae00c73fverc0`, finished `2026-09-12T23:49:49Z`). |

### Why the API deploy was delayed (root cause)

The Render API was **not** deployed for ~6.5 h after push despite the service reporting
`autoDeploy: yes`, `autoDeployTrigger: commit`, `branch: main`. Confirmed via
`render deploys list srv-d7nst5j7uimc73bhq9gg`:

- Last API commit deployed: `3bb647a` at `2026-08-18T17:42:42Z`.
- No deploy record at all existed for `f4dfa09`/`3087351`/`46a4351` — the Sep 12 pushes never
  queued a build. The SPA frontend (Vercel) deployed instantly from the same pushes, so the
  mismatch (web live, api stale) is explained by the Render side, not by a bad commit.

Remediation: deployed manually. The service is reachable from the authenticated Render CLI
(`render whoami` → Brad Johnson), so a dashboard click was not required:

```
render deploys create srv-d7nst5j7uimc73bhq9gg --confirm
```

Verification (post-deploy):

```
reissue        -> 401   (route exists; AUTH_REQUIRED)
validate-stripe -> 401  (control route)
```

`404` before the deploy → `401` after confirms the new route is serving.

Note `api.rayd8.app` is a CNAME to the same backend, so it follows automatically.

### Follow-up: auto-deploy is unreliable

Because the service is configured for commit-triggered auto-deploy on `main` but silently did
not queue a build for the Sep 12 pushes, treat `main` → API deploys as untrusted. Reconnect the
GitHub integration / verify webhook delivery in the Render dashboard, or add a deploy hook so a
missed build is detectable. Until then, confirm each API change with the 404→401 probe above.

Corroborated: a follow-up docs push (`ac80638`) also produced **no** deploy record, so the
webhook is not firing at all rather than the commits being filtered out (e.g. by path ignores).

### Interim behavior (historical)

While the API was still pre-change, the frontend degraded safely: the list falls back to
`display_status ?? stripe_sync_status`, so it rendered correctly and did not crash on missing
fields, but `POST /:id/reissue` and the `status=exhausted` filter returned `404` and clicking
Reissue in production failed with "Promo code action failed." This window is now closed.

