# 02 — Reproduction Matrix

## Environment

- Playwright Chromium / Firefox / WebKit
- Auth: Clerk testing + fixtures `qa.mux.soak@example.com` (REGEN) and `qa.mux.amrita@example.com` (AMRITA)
- Local API/Web with short Mux TTL for refresh exercises
- Physical devices: unavailable

## Closure scenarios

| Scenario | Result |
| --- | --- |
| Authenticated REGEN dual start | Pass |
| 5m dual Chromium/Firefox/WebKit | Pass |
| 30m dual Chromium | Pass (steady budgets) |
| Offline 10s / 30s | 10s pass; 30s video unmount residual |
| Fullscreen + visibility | Pass (no remount) |
| Lifecycle 5× | Pass |
| AMRITA audio/visuals/reduced/full/hidden/cycles | Pass |
| Physical mobile | Unavailable |

## Freeze reproduction

- Class C / F: **not reproduced**
- Class E: confirmed historically; mitigated and bounded in closure soaks
