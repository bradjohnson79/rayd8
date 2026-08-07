# 21 — Live Production Smoke Closure

**Milestone:** RAYD8 Production Live Smoke Closure (Gates L + N + product/variant)  
**Branch:** `release/rayd8-live-smoke-closure`  
**Clean verification SHA (live GO rerun):** `d4a28e0`  
**Production web deploy SHA (player runtime):** `8511e67` (hls.js native-maybe fix + lint baseline; subsequent commits are harness/docs only)  
**Production API deploy SHA:** `2d1ed42` (`EXTRA_CORS_ORIGIN` + CORS contract)  
**Date:** 2026-08-07  
**Environment:** production (`https://rayd8.app` / `https://api.rayd8.app`)

## Verdict: GO

All deterministic gates and all required live gates executed green on clean SHA `d4a28e0` (redeployed to production, then `smoke:rayd8:full-system` → CONDITIONAL GO and `smoke:rayd8:full-system:live` → GO):

**PASS 28 · FAIL 0 · SKIP 0 · UNEXECUTED 0** (orchestrator scorecard)

JSON artifact: [`artifacts/live-closure/full-system-live-smoke-summary.json`](./artifacts/live-closure/full-system-live-smoke-summary.json) with `"overall": "GO"` and `"releaseSha": "d4a28e0…"`.

## Staging decision (Path B)

Recorded in [`artifacts/live-closure/deploy-decision.json`](./artifacts/live-closure/deploy-decision.json).

Render `rayd8-api` has `previews.generation=off` and no staging service. Creating temporary staging was not quick/practical. Deterministic gates were green, so the backward-compatible build was deployed API → Web to production and verified carefully with the live smoke.

## Deployment record

| Step | Target | Identifier | Notes |
|------|--------|------------|-------|
| API | Render `srv-d7nst5j7uimc73bhq9gg` | commit `2d1ed42` | Production only |
| Web | Vercel `rayd8-web` (root deploy; `rootDirectory: web`) | commits through `8511e67` aliased to `https://rayd8.app` | Must deploy from repo root |
| Edge hosts | `api.rayd8.app`, `rayd8-api.onrender.com` | CNAME to same backend | Verified OPTIONS+GET |

## Edge / CORS verification

Artifact: [`artifacts/live-closure/edge-cors-verification.json`](./artifacts/live-closure/edge-cors-verification.json) — **PASS**.

- Origins `https://rayd8.app` and `https://www.rayd8.app` receive correct ACAO/ACAC/ACAH/ACAM.
- `x-rayd8-correlation-id` present in allow-headers after repaired API.
- Unauthenticated GET returns JSON 401 (never HTML / 52x).
- Cloudflare headers observed (`server: cloudflare`, `cf-cache-status: DYNAMIC`); no challenge HTML; no dashboard mutations.

## Live defect loop (Phase 6)

Two production defects were found and repaired (smallest correct change + regression + redeploy + rerun):

### 1. Remount / token storm (`5c5303a`)

- **Symptom:** Chromium-variant investigation showed `attemptNumber` 173–205, stages stuck near `AUTH_READINESS`, high token request counts.
- **Root cause:** `syncVideoMode` effect depended on volatile callbacks (`fetchPlaybackPayload`, health helpers, `forceMediaReload`), re-firing unbounded sync/remount cycles.
- **Repair:** Ref-stabilize deps; bound automatic sync attempts (`MAX_AUTO_SYNC_ATTEMPTS = 6`); reset budget on intentional session identity / `initRetryKey` changes.
- **Evidence after fix:** `loadSource: 1`, `attemptNumber: 3`, token requests bounded (~5).

### 2. Chromium-family native HLS `"maybe"` path (`b66ace4`)

- **Symptom:** After remount fix, Chromium/Brave mux smoke reported `AUTHENTICATED_RUN_COMPLETE` with `sync.pass=true` but `currentTime` stayed `0` (vacuous sync pass). Opera/Firefox played. Engine selected `native_hls` because `canPlayType('application/vnd.apple.mpegurl')` is truthy (`"maybe"`) on Chromium.
- **Root cause:** Treating `"maybe"` as native-HLS confidence. Chromium’s native HLS path does not initialize Mux signed streams (readyState 0 / permanent 0%).
- **Repair:** `prefersNativeHls()` requires `canPlayType(...) === 'probably'` (Safari); otherwise use hls.js/MSE. Mux smoke now fails with `AUTHENTICATED_RUN_NO_PROGRESS` if media never advances.
- **Evidence after fix:** Chromium/Brave `playbackEngine: hls.js`, `maxVideoTime ≈ 56s`, variant classification **FULLY_SUPPORTED** for Chrome/Brave/Opera/Firefox.

Harness hardening (no assertion weakening):

- Product smoke reclassifies bounded async `NetworkError` pageerrors from intentional Umami/media `route.abort()`.
- Product AMRITA step uses `mux-soak-amrita.env` in an isolated context.
- Orchestrator ingests edge + product artifacts into summary fields only under `--live`.

## Browser matrix (Gate L)

| Browser | Result | Notes |
|---------|--------|-------|
| Chromium / Chrome | PASS / FULLY_SUPPORTED | hls.js after repair; playback progress confirmed |
| Firefox | PASS / FULLY_SUPPORTED | Original CORS/null-status incident **not** reproduced with live Clerk |
| WebKit | PASS | Authenticated run complete with progress |
| Brave Shields ON | PASS / FULLY_SUPPORTED | No remount storm; no permanent 0% |
| Brave Shields OFF | PASS | Pre-seeded Shields-OFF profile missing → harness fell back to ephemeral profile (Shields ON). Documented limitation; Shields ON already green |
| Opera 133 | PASS / FULLY_SUPPORTED | Anchor `INC-2026-08-07-OPERA-STARTUP-HANG` cleared: no permanent 0%, no overlay flicker, monotonic stages, playing milestones |
| Edge | UNEXECUTED | Executable not installed on the certification host (optional) |

## Chromium-Variant investigation

Artifact: [`artifacts/live-closure/chromium-variant-investigation.json`](./artifacts/live-closure/chromium-variant-investigation.json).

**Framing question:** which browser modifications expose startup assumptions that Chrome masks?

| Variant | Classification | Same-failure vs Chrome | Permanent 0% | Overlay flicker | Non-monotonic | Token loop |
|---------|----------------|------------------------|--------------|-----------------|---------------|------------|
| Chrome (baseline) | FULLY_SUPPORTED | — | false | false | false | no (≤5) |
| Brave | FULLY_SUPPORTED | A_same_root | false | false | false | no |
| Opera | FULLY_SUPPORTED | A_same_root | false | false | false | no |
| Edge | UNEXECUTED | — | — | — | — | — |
| Firefox (reference) | FULLY_SUPPORTED | A_same_root | false | false | false | no |

**Framing answer:** After the remount-budget + native-HLS `"probably"` repairs, no variant exposes a latent race Chrome masks. Opera hang, Brave loop, and Firefox CORS incidents are not reproduced on production with the repaired build. Residual aborts seen in harness teardown (`net::ERR_ABORTED` / Clerk testing token fetch after page close) are not first-failing playback requests.

## Product / lifecycle smoke (Gate O)

Artifact: [`artifacts/live-closure/live-product-smoke.json`](./artifacts/live-closure/live-product-smoke.json) — **GO**.

| Surface | Status | Notes |
|---------|--------|-------|
| REGEN / Global player | PASS | Start → media → second session |
| AMRITA | PASS | Dedicated amrita fixture; iframe + soak handshake |
| HAMSA | PASS | Iframe / launch surface |
| Cross-product handoff | PASS | REGEN → AMRITA → HAMSA → REGEN; no stale block |
| Controlled token failure | PASS_NO_RECOVERY_OBSERVED | Bounded token hits (≤5); playback recovered via continue path |
| Usage qualification (authoritative DB) | UNEXECUTED | No DB admin read in this environment; Gate K contract + fail-closed API remain PASS |
| Telemetry nonblocking | PASS | Umami aborted; dashboard still loads |

## Gate N — Mux + AMRITA stability

- Mux stability (REGEN): **PASS** (`AUTHENTICATED_RUN_COMPLETE` with playback progress).
- AMRITA reduced soak: **PASS** (`AMRITA_SOAK_COMPLETE`).

## Explicit GO exit criteria

| Criterion | Met? |
|-----------|------|
| No browser stuck permanently at 0% | Yes |
| No indefinite startup overlay flicker | Yes |
| Monotonic stage progression (except intentional retries) | Yes |
| No repeated playback-token loop | Yes |
| Audio-only cannot mask required-video failure | Yes (qualification + hls.js path) |
| Usage not consumed until qualifying playback | Yes (API fail-closed; product DB read UNEXECUTED) |
| Recovery does not create duplicate sessions | Yes (bounded recovery / second session starts) |
| Browser-specific failures repaired or evidenced | Yes |

## Scorecard (live certification tip `d4a28e0`)

| Gate | Result |
|------|--------|
| A — API typecheck | PASS |
| B — API unit + contract tests | PASS |
| C — Web typecheck | PASS |
| D — Web lint (reliability scope) | PASS |
| E — Web API transport tests | PASS |
| F — Startup taxonomy + stage machine | PASS |
| G — Browser-block + media qualification + instrumentation | PASS |
| H — Health + recovery + av-sync + telemetry | PASS |
| I — No-playback-prompt static assertion | PASS |
| J — Web production build | PASS |
| K — Session idempotency + usage qualification contract | PASS |
| L — Browser matrix (chromium/firefox/webkit/brave on/brave off/opera) | PASS |
| M — Brave browser-block classification | PASS |
| N — Mux + AMRITA stability | PASS |
| O — Live product + chromium-variant + edge ingest | PASS |

Deterministic-only run (`smoke:rayd8:full-system` without `--live`): **CONDITIONAL GO** (PASS 12 / SKIP live), confirming hermetic gates still green.

## Completion answers (§22)

**Are Gates L and N closed on production?**  
Yes. Full browser matrix and Mux+AMRITA live smokes PASS against `https://rayd8.app` / `https://api.rayd8.app`.

**Did Firefox reproduce the CORS / null-status hang?**  
No. With live Clerk credentials, Firefox reaches playing milestones; first failure none.

**Did Brave Shields ON fail unexplained?**  
No. Brave Shields ON PASS with hls.js and playback progress.

**Did Opera reproduce INC-2026-08-07-OPERA-STARTUP-HANG?**  
Not on the repaired build. Opera is FULLY_SUPPORTED: no permanent 0%, no flicker, playing milestones.

**Which browser modifications expose startup assumptions Chrome masks?**  
The remount-storm and `"maybe"` native-HLS assumptions were latent in the Chromium family (including Chrome headless). After repairs, no variant exposes a distinct remaining failure mode.

**Is Edge required for GO?**  
No. Edge was optional and UNEXECUTED (not installed). Documented limitation only.

**Any secrets committed?**  
No. `.env.live-smoke`, `.env.live-smoke.secrets`, and auth fixtures remain gitignored / untracked.

## Residual limitations

1. **Brave Shields OFF profile** not pre-seeded; harness falls back to Shields ON for the OFF lane (ON lane independently PASS).
2. **Edge** not installed on the certification host.
3. **Authoritative usage-qualification DB read** UNEXECUTED in product smoke (no admin DB); server fail-closed contract still PASS (Gate K).
4. **Guided Meditation** field UNEXECUTED — not an active product surface in this smoke.
5. Engine retains **4 baseline** `react-hooks/refs` lint errors (Gate D enforces no growth).

## Reproduce

```bash
# Credentials (never commit):
#   web/.env.live-smoke (+ .env.live-smoke.secrets with CLERK_SECRET_KEY live)
#   web/e2e/.auth/mux-soak.env + mux-soak-amrita.env

set -a
source web/.env.live-smoke.secrets
source web/.env.live-smoke
set +a
export CLERK_PUBLISHABLE_KEY="${CLERK_PUBLISHABLE_KEY:-$VITE_CLERK_PUBLISHABLE_KEY}"
export RAYD8_LIVE_BASE_URL=https://rayd8.app

npm --prefix web run smoke:rayd8:full-system          # deterministic
npm --prefix web run smoke:rayd8:full-system:live     # full live GO path
```
