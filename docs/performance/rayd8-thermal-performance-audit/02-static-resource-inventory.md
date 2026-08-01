# Static Resource Inventory

High-risk continuous resources found in Phase 1 (abbreviated; full grep covered rAF/WebGL/HLS/CSS ambient).

| File | Resource | Start | Stop (before) | Risk | Repair |
|------|----------|-------|---------------|------|--------|
| `hamsa/.../AuraBackground.web.tsx` | WebGL + rAF | mount | unmount only | P0 thermal | Gate playing/visible, 30 FPS, lose context |
| `hamsa/.../GlyphBackground.web.tsx` | WebGL + rAF | mount | unmount only | P0 | same |
| `hamsa/.../HandOutlineGlow.web.tsx` | WebGL + rAF | mount | unmount only | P0 | same |
| `web/public/amrita_app/app.js` | WebGL + rAF | startSequence | stop; pause incomplete | P0/P1 | Hard-stop when not running |
| `Rayd8PlayerEngine` + HLS | Dual media decode | session start | end session | P0 when hidden | Visibility pause all sessions |
| `BackgroundSystem` cinematic CSS | Infinite CSS transforms/blur | dashboard mount | never during session | P1 | Minimal ambient when session active |
| `useAuthReadiness.getTokenSafe` | JWT fetch | many callers | n/a | P0 network/main | Use Clerk cache |
| Hero `RAYD8-Premium.png` | 1.5MB image | homepage LCP | n/a | P2 load | Switch to 52KB still |
| `VideoSurface` brightness filter | CSS filter compositing | cinematic default | n/a | P1 GPU | Default performance mode |

Lower risk (already gated or intentional): landing ambient profile auto-downgrade, `html[data-tab-hidden]` CSS pause for particles, Amrita DPR caps (`maxDevicePixelRatio: 1.65`).
