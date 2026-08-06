# 09 — Mux Wiring

## Path

`Rayd8PlayerEngine.fetchPlaybackPayload` → member `GET /v1/player/playback-token` or admin Mux token → `playback.signed_url` → `setMediaSource` (native HLS or `hls.js`) → readiness → play → health guard.

## Token refresh

Mux refresh is scheduled from payload expiry (lead time). Refresh does **not** bump health `resetKey`. A mid-session refresh failure is a different class from startup health overlay; startup overlay is usually pre-healthy-predicate.

## Failure → UI

| Mux failure | Typical UI class |
|---|---|
| Token 403 trial/preview | Soft denial |
| Token 5xx / network | `initFailureVisible` or health path if partial progress |
| Source not applied | Health soft recovery → hard fallback (screenshot class) |
| Asset missing | Init/health depending on throw site |

## Audit constraint

No soak reuse as certification. Wiring-only confirmation: Mux is required for Express/REGEN video; Amrita/Hamsa do not use this Mux token path for their primary visuals.
