# 04 — Frontend Wiring

## Route-unmount ownership table

| Component | Mounted by | Unmounted when | Can remount automatically? | State preserved? |
|---|---|---|---|---|
| Session overlay (`Rayd8SessionOverlay`) | App shell when `SessionProvider.isActive` | `endSession` / `isActive=false` | Only via new `startSession` | No — portal destroyed |
| Player engine (`Rayd8PlayerEngine`) | Overlay portal | Overlay unmount / Return Home / Reload (`onClose`) | Reload remounts after rAF `startSession` | No — local React state gone; Try Again keeps mount |
| Video surface (`primaryVideoRef`) | Engine render | Engine unmount; `destroyPrimaryVideoPipeline` | On remount / mode change | Media element recreated with tree |
| Audio rail (global audio in `SessionProvider`) | Session active dual mode | Session inactive / cleanup effects | Next session | Torn down when inactive |
| AMRITA iframe | `AmritaRoutePage` | Leave `/amrita` route | Navigation back | Iframe reload on remount; no session postMessage |
| HAMSA session | `HamsaFullscreenSession` / Hamsa route | Exit/close handlers | Re-open | Local canvas state not shared with Express |

## Implication

A media-health failure does **not** automatically tear down the Express session. Only Return Home / Reload / explicit `endSession` unmounts the overlay. Media problems can therefore be **mislabeled** as "session startup" while the session overlay remains mounted.

## Key frontend modules

- `Rayd8Dashboard.tsx` — access + start
- `SessionProvider.tsx` — session lifecycle, soft denial, tracking, audio
- `Rayd8SessionOverlay.tsx` — portal mount
- `Rayd8PlayerEngine.tsx` — token, media, health, recovery buttons
- `usePlaybackHealthGuard.ts` — timers + healthy predicate
- `mediaController.ts` — native / hls.js source apply
- `services/api.ts` — fetch without AbortSignal / correlation headers
