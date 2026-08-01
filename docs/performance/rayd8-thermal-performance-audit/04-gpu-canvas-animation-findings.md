# GPU / Canvas / Animation Findings

## Hamsa

Architecture: three stacked WebGL canvases (aura full-viewport, hand glow, per-glyph discs) driven by shared Reanimated pulse values.

Before: all three ran ~60 FPS from iframe mount with `isPlaying=false` still drawing every frame (Aura only froze time uniforms).

After:
- `shouldRunHamsaWebglLoop(isPlaying)` requires playing + visible + not reduced-motion
- Target 30 FPS (`HAMSA_WEBGL_TARGET_FPS`)
- `powerPreference: 'low-power'`
- `WEBGL_lose_context` on cleanup
- Mirrored to `hamsa-mobile`

## Amrita

- No rAF until start (good)
- Pause/hidden previously left rAF alive via `runtime !== 'idle'` re-arm
- After: `renderFrame` returns immediately unless `runtime === 'running'`; `togglePause` cancels frame id
- `powerPreference` changed from `high-performance` to `default`
- Two-pass feature retained; shared WebGL background + glyph canvas

## Dashboard ambient

Cinematic CSS infinite animations (aurora/cosmic/particles) under player → session-active forces `minimal` + `reducedEffects`.

## Justification for remaining GPU

- Hamsa/Amrita WebGL only while actively running a session
- Browser compositing for CSS ambient on marketing/dashboard idle is intentional and profile-gated
- No WebGPU / Three.js dependency found
