# 10 — Automated Test Results

## Unit / targeted

| Suite | Command | Result |
| --- | --- | --- |
| Mux TTL resolver | `npm --prefix api run test:mux-ttl` | Pass (4) |
| Recovery state machine | `npm --prefix web run test:recovery-machine` | Pass (3) |
| A/V sync controller | `npm --prefix web run test:av-sync` | Pass (5) |
| Aggregated | `npm run test:mux-unit` | Pass |

## Stability harness

| Run | Browser | Duration | Dual audio | Verdict | Key notes |
| --- | --- | --- | --- | --- | --- |
| Smoke | Chromium | short | varies | `AUTHENTICATED_RUN_COMPLETE` | Session start + media mount |
| Soak | Chromium | 5 min | pre dual-gate | Complete | Event-loop healthy |
| Soak | WebKit | 5 min | pre dual-gate | Complete | Authenticated |
| Soak | Firefox | 5 min | pre dual-gate | Complete | Authenticated |
| Release soak | Chromium | 30 min | video-focused | Complete | See `soak-chromium-30m-valid-summary.json` |
| Dual-audio | Chromium | 3 min | required | Complete | Real audio buffers; sync corrections |
| Dual-audio | Chromium | 10 min | required | Complete | Sample \|drift\| ≤~0.42s; 10 corrections; freezeEvents all Class E `av_desync`; event-loop max 1.5ms; 0 long tasks >200ms |

Artifacts: [`artifacts/`](artifacts/)

Primary dual-audio evidence: [`artifacts/soak-chromium-10m-dual-audio-summary.json`](artifacts/soak-chromium-10m-dual-audio-summary.json) → `mux-stability-soak-chromium-1785265684917.json`.

## Auth fixture

`npm --prefix api run fixture:mux-soak-auth` creates/updates REGEN QA user + guide-seen settings and writes gitignored `web/e2e/.auth/mux-soak.env`.

Harness notes:

- Clerk modal OTP blocks password login; use `@clerk/testing` `clerk.signIn({ emailAddress })`.
- `RAYD8_MUX_REQUIRE_DUAL_AUDIO=1` (or non-`0`) requires a live global audio `currentSrc` before soak sampling.
- Video missing after start fails the run (guards invalid “started” artifacts).
