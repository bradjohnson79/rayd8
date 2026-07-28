# 04 — Root Cause Analysis

## Freeze classification from measured soaks

| Run | Browser | Duration | Freeze class | Notes |
| --- | --- | --- | --- | --- |
| Chromium pre-AV-sync | Chromium | 5 min | **E A/V desync** | Drift 0.8s → **278s**; no Class A/B/C freeze events; event-loop max ~13ms; 0 long tasks >200ms |
| WebKit | WebKit | 5 min | **E A/V desync** (pre-sync code path) | Authenticated dual pipeline completed; see artifact summary |
| Chromium dual-audio post-R7 | Chromium | 10 min | **E only** (mitigated) | Sample \|drift\| ≤~0.42s; 10 corrections; 60 logged `av_desync` threshold crossings; event-loop max 1.5ms; 0 long tasks >200ms |
| Chromium dual closure | Chromium | 30 min | **E mitigated** | 5–7 corrections/5m; steady avg \|drift\| ~0.21s; one loop-wrap outlier excluded; 0 long tasks >200ms |
| Chromium video soak | Chromium | 30 min | None (C/F) | Video stayed mounted; Class E false-positive path gated when audio empty |
| Device-wide OS freeze | Physical | — | **F** not tested | Emulated-only in this environment |

Client “device freeze” reports were **not reproduced** as Class C (browser-tab unresponsive) or Class F on the lab host. The dominant measured defect is **Class E: audio/video desynchronization** on the dual HLS pipeline, which can present as a broken session and may be reported colloquially as a freeze. Post-R7 dual-audio soaks show bounded sample drift with corrector engagement.

## Hypothesis disposition

| Hypothesis | Status | Supporting evidence | Contradicting evidence | Repair |
| --- | --- | --- | --- | --- |
| Dual-HLS buffer pressure | INCONCLUSIVE | Dual pipeline confirmed; large desktop buffers | No heap growth instrumentation conclusive in 5m; no Class C freeze | Deferred |
| Recovery-loop thrashing | CORRELATED (code) / NOT REPRODUCED (soak) | Cooldown-only authority could storm; unit storm test | Soak showed 0 recovery actions | R3 bounded SM |
| CSS brightness compositing | UNTESTED | Filter present in cinematic mode | No A/B yet | Deferred |
| Mid-play token refresh | CONFIRMED (code bug) / CORRELATED (soak loadSource) | Refresh never scheduled for 12h tokens; short-TTL soak had loadSource=4 | Not sole cause of multi-minute desync | R1 + R4 |
| AMRITA WebGL + Mux audio | UNTESTED | Isolation harness pending dedicated AMRITA soak | — | Deferred |
| Excessive rendition selection | UNTESTED | Display 1280x720 from 1920x1080 source | No level metrics on native HLS | Deferred |
| Hidden-tab lifecycle defects | INCONCLUSIVE | AMRITA already pauses on hidden | Member player cleanup afterExit still showed video=1 in harness (close incomplete) | Partial |
| Timer/listener/HLS leakage | CONFIRMED (native path) | Native branch left hls.js alive | Active HLS count empty under native | R2 |
| Dual A/V independent clocks | **CONFIRMED Class E** (true dual) + **REJECTED as Class C**; earlier empty-audio runs were false positives | True dual 10m soak: buffers ~9–10s both rails; corrector 10×; residual `av_desync` logs; no Class C | Empty-audio runs showed 278–740s drift with corrections=0 / null buffers | Drift gating + dual-audio soak gate + R7 corrector |

## Freeze detector trustworthiness

During the Chromium 5m soak, freeze-poll delay and event-loop delay remained low (max event-loop ~13ms). The detector continued executing; absence of Class A stalls is trustworthy for that run.
