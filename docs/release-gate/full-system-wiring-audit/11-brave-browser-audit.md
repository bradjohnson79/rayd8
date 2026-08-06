# 11 — Brave Browser Audit

## Scope

Browser-native Brave Shields focus (not third-party extension matrix). Compare with Chrome using same account/session configuration.

## Lab availability

| Browser | Available on host |
|---|---|
| Chrome | Yes (`/Applications/Google Chrome.app`) |
| Brave | **Unavailable** on lab host at audit time (no Brave.app binary) |
| Firefox | Yes |
| Safari | Yes |
| Edge / Android / iOS | **Unavailable** in this lab — labeled CONDITIONAL |

## Priority cases

| Case | Status | Notes |
|---|---|---|
| Default Shields | Exercised short (see artifacts) | Third-party script (Umami) may be blocked; must remain noncritical |
| Shields disabled for rayd8.app | CONDITIONAL — manual | Do not disable merely to obtain a pass |
| Private window default Shields | CONDITIONAL — manual | Cookie partitioning risk for Clerk |
| Aggressive fingerprinting | CONDITIONAL — manual | |
| Script blocking | CONDITIONAL — may break app JS if first-party blocked | Treat as user-hostile config |
| Cookie blocking | CONDITIONAL — Clerk session break → auth denial class | |

## Classification vocabulary for Brave failures

`ERR_BLOCKED_BY_CLIENT` | CORS | cookie rejection | CSP rejection | mixed content | aborted | network failure

## Brave vs Chrome (same account intent)

Static + short network observation: first-party app/API hosts should match Chrome when Shields allow first-party. Differences concentrate on **third-party** (Umami, possibly fingerprinting heuristics). Mux media hosts are first-party-authorized CDN URLs; if Shields blocks media CDN, expect **playback-health** or init failure — classify as browser-blocked request, not session-create failure.

See `12-browser-functional-matrix.md` and `artifacts/browser-blocking-report.md`.


## Lab result (2026-08-06)

Brave Browser was **not installed** on the audit host when probes ran (`executablePath` launch failed / app missing). Therefore Shields matrix cases are **CONDITIONAL**.

Compensating evidence:
- Chromium short shell probe vs Firefox/WebKit (`artifacts/short-browser-shell-probes.json`)
- Simulated `ERR_BLOCKED_BY_CLIENT` on Umami assets (`artifacts/umami-block-simulation.json`) — page still 200, no pageerrors
- Static policy classification remains valid for when Brave is available

Do **not** treat Chrome-only as Brave certification.
