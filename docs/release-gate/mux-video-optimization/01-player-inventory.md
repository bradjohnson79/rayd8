# 01 — Player Inventory

## Playback surface matrix

| Playback surface | Route | Player component | Mux implementation | Mobile use | Visual systems active | Risk level |
| --- | --- | --- | --- | --- | --- | --- |
| Member RAYD8 session | `/dashboard` → session overlay | `Rayd8PlayerEngine` + `GlobalAudioRail` | Signed HLS (`hls.js` or native) dual A/V | Yes | Overlays, brightness, amplifier edges | High |
| Admin global players | `/admin/global-players/{expansion,premium,regen}` | Same overlay via `startSession` | Admin signed token | Yes | Same as member | High |
| Admin Mux tool | `/admin/mux` | Token/asset ops only | Signing API | N/A | None | Low |
| AMRITA member | `/amrita-dashboard` → iframe `/amrita_app/` | AMRITA runtime + `audio-layer.js` | Mux HLS **audio** | Yes | WebGL + canvas glyphs | High |
| AMRITA admin preview | `/admin/amrita` | Same iframe | Mux HLS audio | Yes | Same | High |
| HAMSA | `/dashboard/hamsa`, `/admin/hamsa` | HAMSA web/mobile apps | **No Mux** (local MP3) | Yes | WebGL/canvas | Medium (non-Mux) |
| Landing demo | `/#rayd8-demonstration` | YouTube iframe | No Mux | Yes | None | Low |
| Landing testimonials | `/` | YouTube IFrame API | No Mux | Yes | None | Low |
| Legacy `/player` | redirects to `/dashboard` | Unrouted `PlayerPage` | Local MP4 only | N/A | Legacy | Low |

## Shared implementation notes

- No `@mux/mux-player` / `MuxPlayer` in repo.
- Signing: `GET /v1/player/playback-token` (member) and `GET /api/admin/mux/playback-token` (admin).
- Default JWT TTL: 12 hours; QA short TTL via `MUX_PLAYBACK_TOKEN_TTL_MINUTES` (non-prod / explicit allow).
- Combined A/V flag `VITE_RAYD8_SINGLE_AV_PIPELINE` exists but asset map is empty — dual pipeline remains production default.

## Freeze taxonomy used in this audit

A Media stall · B Player UI freeze · C Browser-tab freeze · D Graphics freeze · E A/V desync · F Full device instability
