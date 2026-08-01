# Media Visibility Refinement

- Express: `useMobilePlaybackLifecycle({ enabled: isActive })` pauses video+audio on hide.
- HLS create/destroy registers with RuntimeResourceRegistry owner `Express Player`.
- Session end marks cleanup timeline `express_session_stop`.
- Dashboard session-active ambient remains minimal (no competing dashboard `<video>` found).
