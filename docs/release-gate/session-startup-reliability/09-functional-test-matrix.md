# 09 — Functional Test Matrix

| Area | Result | Notes |
|---|---|---|
| Taxonomy mapping | Pass | unit |
| Overlay selection | Pass | unit |
| Health timer gating | Pass | unit |
| Hidden/offline/autoplay | Pass | unit |
| Audio/dual predicates | Pass | unit |
| Force reload retry | Pass | source + unit |
| End idempotency | Pass | source invariant + vitest |
| Reconcile dry-run | Pass | vitest |
| No Tap-to-Start modal | Pass | `test:no-playback-prompt` |
| Authenticated Express live | CONDITIONAL | no lab auth storage |
| Brave Shields live | CONDITIONAL | Brave not installed |
