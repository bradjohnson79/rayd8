# Video / HLS / Mux Findings

## Defects

1. Visibility lifecycle enabled only for `mobilePlaybackRefactorEnabled && touchLikeFullscreenViewport` — **desktop MacBook never paused media on tab hide**.
2. Authority `tab_hidden` was a no-op.
3. Desktop HLS buffers 40/120/90 were aggressive for thermal/memory.
4. Default cinematic presentation applied CSS `brightness()` filter on the video element.

## Repairs

- `useMobilePlaybackLifecycle({ enabled: isActive })` for all active sessions
- On hide: pause video + global audio, dispatch `tab_hidden`
- On show: `tab_visible` → authority resumes video + audio delegates
- Desktop buffers: back 30 / max 24 / maxMax 60
- Presentation default: `performance` (env `VITE_RAYD8_PLAYBACK_PRESENTATION_MODE=cinematic` to restore)

## Policy status

- Only active visible media should decode — **implemented for Express player tab-hide**
- Marketing/testimonial players: separate path; not dual-Mux
- Mux freeze audit residuals unchanged (see prior Mux closure docs)
