# 08 — Memory and Lifecycle Review

## Confirmed lifecycle defects (repaired)

1. Native HLS could leave hls.js attached → R2.
2. Mux refresh never armed for 12h tokens → R1.
3. Recovery storms after cooldown-only policy → R3.

## Closure lifecycle 5× (dual-HLS)

Artifact: `artifacts/final-closure/closure-lifecycle-5x-summary.json`

| Cycle | midVideos | midAudios | afterVideos | afterAudios | HLS after |
| --- | --- | --- | --- | --- | --- |
| 1–5 | 1 | 1 | 1 | 1 | empty |

No progressive media/HLS growth across five enter/play/exit cycles.

## AMRITA re-entry

Hidden-tab + 5 cycle soak completed (`amrita-soak-full-*` with cycles). No canvas growth failure verdict.

## Fullscreen

`noRemount: true` after enter/exit fullscreen + visibility pulse.
