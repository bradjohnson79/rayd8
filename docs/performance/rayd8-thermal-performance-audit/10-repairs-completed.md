# Repairs Completed

| ID | Repair | Files |
|----|--------|-------|
| R-T1 | Hamsa WebGL play/visibility/FPS gate + lose context | `hamsa/utils/webglRenderLoop.ts`, Aura/Glyph/Hand `.web.tsx`, CenterDisplay, index; mirrored `hamsa-mobile` |
| R-T2 | Amrita hard-stop rAF when not running | `web/public/amrita_app/app.js` |
| R-T3 | Desktop+all-session media pause on hide | `useMobilePlaybackLifecycle.ts`, `Rayd8PlayerEngine.tsx` |
| R-T4 | Dashboard minimal ambient during session | `DashboardShell.tsx` |
| R-T5 | Visual Performance Automatic/Standard/Reduced | `visualPerformancePreference.ts`, hook, Sidebar, landing mode |
| R-T6 | Clerk token cache restore | `useAuthReadiness.ts` |
| R-T7 | Performance presentation default | `Rayd8PlayerEngine.tsx`, `VideoSurface.tsx` path |
| R-T8 | Desktop HLS buffer reduction | `getPlaybackStabilityProfile` |
| R-T9 | Hero LCP still optimization | `HeroSection.tsx` + `RAYD8_Hero.png` |
| R-T10 | Heartbeat + freeze poll visibility gates | `SessionProvider.tsx`, `Rayd8PlayerEngine.tsx` |
| R-T11 | Regression harness | `thermal-performance-regression.mjs`, unit tests, npm scripts |

## Intentional non-repairs

- Session context split (P0-3 structural) deferred
- Global hardware acceleration disable (forbidden)
- Removing Amrita two-pass (forbidden)
