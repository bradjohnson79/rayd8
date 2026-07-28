# 14 — Final Certification Scorecard

## Verdict: **CONDITIONAL GO**

Authenticated Mux/HLS playback on RAYD8 is cleared for desktop browser release gates after evidence-gated repairs and multi-browser soaks. **Class C (tab freeze)** and **Class F (device freeze)** were **not reproduced** on the lab host. Residual gaps (physical mobile, full AMRITA/offline/fullscreen matrices, production telemetry sink) keep the certificate conditional.

| Gate | Required for GO | Result | Status |
| --- | --- | --- | --- |
| Player inventory | Complete | Dual HLS + native/`hls.js`; no `@mux/mux-player` | Pass |
| Freeze taxonomy A–F | Instrumented | Classes logged; lab soaks show E only when dual A/V active | Pass |
| Confirmed defect repairs | Evidence-gated | R1–R7 applied with unit coverage where applicable | Pass |
| Authenticated E2E soak | Mandatory | Chromium/Firefox/WebKit 5m + Chromium 30m video + Chromium 10m dual-audio | Pass |
| Native HLS path | Exercised | Chromium soak used `native_hls` | Pass |
| Class C / F reproduction | Attempted | Not reproduced (event-loop ≤~16ms; 0 long tasks >200ms) | Pass (neg.) |
| Physical mobile Class F | Preferred for full GO | Not executed in this environment | **Gap** |
| AMRITA A–F isolation | Preferred | Incomplete | **Gap** |
| Offline / fullscreen / orientation | Preferred | Incomplete automation | **Gap** |
| Production telemetry sink | Preferred | Client correlation ID only | **Gap** |
| Speculative global quality cuts | Forbidden | Not applied | Pass |
| Auto combined A/V | Forbidden without compat | Asset map empty; not auto-enabled | Pass |

## Evidence anchors

| Artifact | What it proves |
| --- | --- |
| [`artifacts/soak-chromium-30m-valid-summary.json`](artifacts/soak-chromium-30m-valid-summary.json) | 30m Chromium video soak mounted continuously; responsiveness healthy |
| [`artifacts/soak-chromium-10m-dual-audio-summary.json`](artifacts/soak-chromium-10m-dual-audio-summary.json) | 10m dual pipeline: buffers on both rails; sample \|drift\| ≤~0.42s; corrector engaged; freezeEvents = Class E `av_desync` only; event-loop max 1.5ms; 0 long tasks >200ms |
| [`artifacts/soak-chromium-3m-dual-audio-summary.json`](artifacts/soak-chromium-3m-dual-audio-summary.json) | Dual-audio smoke with real audio buffer + sync corrections |
| Browser 5m soaks under [`artifacts/`](artifacts/) | Chromium / Firefox / WebKit authenticated completion |
| Unit: `npm run test:mux-unit` | TTL resolver, recovery machine, A/V sync controller |

## Freeze-class disposition

| Class | Lab disposition |
| --- | --- |
| A Stall | Not sustained in soaks |
| B Buffering storm | Not reproduced |
| C Tab unresponsive | **Not reproduced** |
| D Decode / dropped frames | No Class C coupling; decode metrics collected when available |
| E A/V desync | **Confirmed** on dual pipeline (false positives when `audioTrack=none` fixed); mitigated by R7 corrector; residual threshold crossings logged |
| F Device freeze | **Untested** on physical hardware |

## Release conditions

Ship desktop authenticated Mux sessions under this certificate **if**:

1. R1–R7 remain in the release candidate.
2. Short-TTL / soak harness scripts stay available for regression (`test:mux-stability:smoke`, `test:mux-stability:soak`, `fixture:mux-soak-auth`).
3. Support runbooks capture playback `correlationId` on severe reports.

Do **not** claim full GO until:

1. Physical iOS/Android Class F soaks (thermal / multi-minute) are recorded.
2. AMRITA + Mux audio isolation matrix is completed.
3. Offline / fullscreen / orientation harness rows are filled.
4. Privacy-safe production sink receives correlation + stall class fields ([`13-production-monitoring-plan.md`](13-production-monitoring-plan.md)).

## Branch / baseline

- Branch: `audit/mux-video-optimization`
- Baseline tag: `audit/mux-baseline-c0e6796`
- Starting SHA: `c0e6796e80e7fb3bfccd140e0d3d6dd247cbe38b`
