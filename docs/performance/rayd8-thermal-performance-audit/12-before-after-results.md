# Before / After Results

| Metric / defect | Before (baseline SHA fb9ed24) | After (this branch) |
|-----------------|-------------------------------|---------------------|
| Hamsa idle WebGL loops | 3 continuous rAF WebGL contexts | 0 continuous loops; static frame only |
| Amrita paused rAF | Re-armed while paused | Hard-stopped |
| Desktop tab-hide media | Kept decoding | Paused |
| Dashboard ambient during session | Cinematic | Minimal / reducedEffects |
| Hero still bytes | ~1.5 MB Premium | ~52 KB `RAYD8_Hero.png` (~97% reduction) |
| Presentation filter | CSS brightness default | Performance default |
| Desktop HLS max buffer | 40 / 120 | 24 / 60 |
| Token fetch | skipCache always | Cached JWT |
| Homepage Lighthouse perf (local) | Not captured this pass | 0.75; LCP ~5.3s; TBT 14ms |

Absolute thermal (°C / Energy Impact) before/after on Safari not yet instrumented — tracked as remaining risk.
