# 02 — Reproduction Matrix

## Environment

- Emulated browsers via Playwright: Chromium, Firefox, WebKit
- Host: Apple Silicon Mac (darwin)
- Auth: Clerk testing helper + QA fixture `qa.mux.soak@example.com` (REGEN)
- API/Web: local (`http://127.0.0.1:3001` + `http://127.0.0.1:5173`)
- Physical devices: **not available** in this environment (residual risk)

## Scenarios executed

| Scenario | Chromium | Firefox | WebKit | Result |
| --- | --- | --- | --- | --- |
| Authenticated member REGEN start | Yes | In progress / Yes | Yes | Pass (session starts, video mounts) |
| Sustained 5 min dual A/V | Yes (×2) | Pending/Yes | Yes | Pass for Class A/B/C; **Class E desync observed** |
| Sustained 30 min | Planned after Firefox | — | — | Pending artifact |
| Token short-TTL refresh path | Yes (`MUX_PLAYBACK_TOKEN_TTL_MINUTES=3`) | — | — | loadSource observed (4) without Class C freeze |
| Fullscreen / orientation | Not fully automated | — | — | Residual |
| Offline recovery | Not fully automated | — | — | Residual |
| Repeated 5× session cycles | Not fully automated | — | — | Residual |
| AMRITA A–F isolation | Shell route only | — | — | Residual |
| HW accel on/off | Not run | — | — | Residual |
| Physical mobile | No | No | No | Residual / CONDITIONAL |

## Freeze reproduction answer

- **Class C / F device freeze:** NOT REPRODUCED in 5-minute instrumented Chromium (event-loop max ~13ms, 0 long tasks >200ms).
- **Class E A/V desync:** CONFIRMED (drift → ~278s / 5 min) on dual pipeline before effective audio-resume/seek corrector.
