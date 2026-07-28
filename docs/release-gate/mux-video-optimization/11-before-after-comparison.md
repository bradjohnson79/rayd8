# 11 — Before / After Comparison

## Chromium authenticated dual pipeline

| Metric | Before key repairs | After R1–R6 (pre stall-seek / false Class E) | After R7 + dual-audio soak gate (10m) |
| --- | --- | --- | --- |
| Event-loop max | ~13ms | ~9–13ms | **1.5ms** |
| Long tasks >200ms | 0 | 0 | **0** |
| A/V drift | 0.8s → **278s** (often empty audio) | still large when `audioTrack=none` | sample \|drift\| **≤~0.42s**; controller maxAbs ~1.39s transient |
| Sync corrections | 0 | 0 (no `currentSrc`) | **10** (6 resume + 4 seek) |
| Freeze events | 0 Class C | 0 Class C | 60 Class E `av_desync` threshold crossings; **0 Class C** |
| `loadSource` (short TTL) | N/A | 4 (5m) | 8 (10m @ ~3m TTL) |
| Media elements during play | 1 video + 1 audio | same | same dual pipeline + buffers ~9–10s |
| HLS instances (native path) | leak risk | 0 active after R2 | 0 |
| Token refresh scheduling | never for 12h TTL | always scheduled | always |
| Unbounded recovery | possible | unit-denied | unit-denied |

## Interpretation

Main-thread responsiveness remained healthy throughout. Lab “freeze” reports mapped to **Class E desync** (and earlier false positives when audio was empty), not Class C tab freezes. R7 keeps dual-pipeline drift bounded under continuous play; residual `av_desync` events are threshold crossings handled by the corrector.

## Watch-time writes

Heartbeat remains 30s (`HEARTBEAT_MS`). No evidence of per-`timeupdate` write storms in the player path audited.
