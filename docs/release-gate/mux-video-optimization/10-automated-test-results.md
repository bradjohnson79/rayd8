# 10 — Automated Test Results

## Unit

| Suite | Command | Result |
| --- | --- | --- |
| Mux TTL | `npm --prefix api run test:mux-ttl` | Pass |
| Recovery machine | `npm --prefix web run test:recovery-machine` | Pass |
| A/V sync | `npm --prefix web run test:av-sync` | Pass |
| Telemetry redaction | `npm --prefix web run test:mux-telemetry` | Pass |
| Aggregated | `npm run test:mux-unit` | Pass |

## Stability / closure

| Run | Result | Artifact |
| --- | --- | --- |
| Smoke dual Chromium | Pass | `artifacts/final-closure/phase1-smoke-chromium.json` |
| 5m dual Chromium/Firefox/WebKit | Pass | `phase1-soak-*-5m.json` |
| 30m dual Chromium | Pass (reclassified loop-wrap) | `soak-chromium-30m-dual-audio-summary.json` |
| Offline dual 3m | Pass w/ 30s residual | `closure-offline-dual-3m-summary.json` |
| Fullscreen dual 3m | Pass | `closure-fullscreen-dual-3m-summary.json` |
| Lifecycle 5× | Pass | `closure-lifecycle-5x-summary.json` |
| AMRITA A–F | Pass | `amrita-soak-*` |

## Scripts

```bash
npm run test:mux-unit
npm run test:mux-stability:smoke
npm run test:mux-stability:soak
npm run test:mux-stability:closure   # release-only
npm --prefix web run test:amrita-mux-stability
npm run fixture:mux-soak-auth        # regen + amrita users
```
