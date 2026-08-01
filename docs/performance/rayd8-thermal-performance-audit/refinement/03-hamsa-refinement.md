# Hamsa Refinement

## Lazy WebGL

`AuraBackground`, `GlyphBackground`, and `HandOutlineGlow` (web + hamsa-mobile) call `getContext('webgl')` only inside `ensureGl()` when `isPlaying` is true.

## Terminal draws

On STOP (`isPlaying` false with existing context): one bounded `drawOnce`, then `WEBGL_lose_context`.

## Probe / controller

`window.__HAMSA_PERF__` exposes `getSnapshot`, `setRenderFPS`, `setRenderScale`, `pauseRendering`, `resumeRendering`, `dispose`, `status`.

## Acceptance

| State | Expected |
|-------|----------|
| Before start | contexts = 0 |
| Active | contexts ≤ 3, loops when visible |
| Paused/stopped | activeLoops = 0; contexts disposed on stop |
| Navigated away | loseContext on unmount |
