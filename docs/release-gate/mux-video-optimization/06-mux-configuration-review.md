# 06 — Mux Configuration Review

## Signing

| Setting | Value |
| --- | --- |
| Default JWT TTL | 12 hours (`DEFAULT_MUX_PLAYBACK_TOKEN_TTL_MINUTES`) |
| QA short TTL | `MUX_PLAYBACK_TOKEN_TTL_MINUTES` (min 2), blocked in production unless `RAYD8_ALLOW_SHORT_MUX_TTL=true` |
| Client refresh lead | 90 seconds before expiry |
| Pre-repair defect | Refresh timer skipped when remaining TTL > 30 minutes (never scheduled for 12h tokens) |
| Post-repair | Always schedule; pause before `loadSource`; restore `currentTime`; max 3 failures |

## Playback client

| Setting | Value |
| --- | --- |
| Player SDK | Not `@mux/mux-player` — custom `hls.js` / native HLS |
| Stream type | VOD signed `.m3u8` |
| Dual pipeline | Video + separate audio HLS (default) |
| Combined A/V | Flag exists; asset map empty — not preferred |
| Desktop buffers | back 90 / max 40 / maxMax 120 |
| Mobile buffers | back 60 / max 24 / maxMax 72 |
| capLevelToPlayerSize | true (hls.js path) |

## Renditions / assets

Representative REGEN asset IDs live in [`api/src/config/rayd8Expansion.ts`](../../../api/src/config/rayd8Expansion.ts). Soak used production catalog IDs via normal session resolution. Exact ladder/codec/fps require Mux API asset retrieve — not committed with signed URLs.

## Secrets policy

No signed URLs, JWTs, or signing keys are written to certification artifacts (redaction in stability harness + diagnostics).
