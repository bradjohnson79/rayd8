# 08 — Memory and Lifecycle Review

## Confirmed lifecycle defects

1. **Native HLS path** could leave an `hls.js` controller attached → destroyed before native `src` assignment (R2).
2. **Mux refresh scheduling** never armed for 12h tokens → always schedule (R1).
3. **Recovery storms** possible after cooldown-only policy → bounded `RecoveryStateMachine` (R3).

## Soak observations (Chromium 5m)

| Metric | Start | End | After exit attempt |
| --- | --- | --- | --- |
| `<video>` count | 1 | 1 | 1 (harness close incomplete) |
| `<audio>` count | 1 | 1 | 1 |
| Active HLS instances | 0 (native path) | 0 | 0 |
| Long tasks >200ms | 0 | 0 | — |
| Event-loop max | — | ~13ms | — |

## Repeated-session cycles

Automated ≥5 enter/exit leak matrix not fully completed in this milestone. Harness close button detection is incomplete (afterExit still shows media elements). Treat progressive multi-cycle leak certification as residual; unit-level destroy paths covered for HLS controller + recovery machine reset.

## A/V desync lifecycle

Dual pipeline clocks diverged severely (Class E). Corrector now resumes/seeks stalled audio toward video master, skipping video loop wraps.
