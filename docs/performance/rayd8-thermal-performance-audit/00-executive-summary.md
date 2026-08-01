# Executive Summary

**Verdict: CONDITIONAL GO**

Customer cancellation cited slow load and MacBook Pro overheating. Static audit + production build verification identified concrete thermal and load-time defects. Priority 0–1 repairs are implemented and regression-gated on branch `audit/rayd8-performance-thermal`.

## Root causes (evidence-backed)

1. **Hamsa idle triple WebGL** — `AuraBackground`, `GlyphBackground`, and `HandOutlineGlow` ran continuous `requestAnimationFrame` WebGL redraws from mount, before START.
2. **Desktop Mux kept decoding while hidden** — visibility lifecycle was mobile-fullscreen-only; `tab_hidden` authority path was a no-op and did not pause media.
3. **Amrita paused sessions still re-armed rAF** — pause cancelled one frame, but `renderFrame` rescheduled while `runtime === 'paused'`.
4. **Dashboard cinematic ambient under sessions** — `Rayd8Background` stayed cinematic beneath the player overlay.
5. **Clerk token cache bypass** — `getToken({ skipCache: true })` on every readiness call multiplied JWT work during heartbeats/polls.
6. **Hero LCP asset** — `/hero/RAYD8-Premium.png` (~1.5MB) vs optimized `/hero/RAYD8_Hero.png` (~52KB).
7. **Cinematic video CSS filter** — default `filter: brightness()` forced continuous compositing on the video layer.

## Repairs shipped (this branch)

- Hamsa / hamsa-mobile WebGL gated to playing + visible, 30 FPS cap, `WEBGL_lose_context` on cleanup
- Amrita hard-stops rAF when not running; resumes only on unpause
- Player visibility pause for **all** active sessions; pauses video + audio on hide
- Dashboard ambient drops to minimal during active sessions; Visual Performance control added
- Token cache restored; presentation defaults to performance; desktop HLS buffers reduced
- Hero still switched to optimized asset

## Why not GO

- Full Safari Activity Monitor / 30-minute soak / Windows matrix not completed in this pass
- Homepage LCP remains Clerk-dominated (~5.3s local preview after repairs)
- SessionProvider context split (player rerenders on usage heartbeat) not yet done
- Physical mobile Class F and long-session heap plateau evidence incomplete

## Recommendation

Merge after short MacBook Safari smoke (Hamsa idle fans, Amrita pause, Express tab-hide) and monitor cancellation/support signals.
