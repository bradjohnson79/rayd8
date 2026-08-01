# Runtime Lifecycle

```mermaid
stateDiagram-v2
  [*] --> Idle
  Idle --> Loading: start
  Loading --> Ready: assets ready
  Ready --> Playing: first frame
  Playing --> Paused: pause
  Paused --> Playing: resume
  Playing --> Hidden: tab hide
  Hidden --> Playing: tab show resume
  Paused --> Hidden: tab hide
  Hidden --> Paused: still paused
  Playing --> Completed: duration end
  Paused --> Completed: duration end
  Completed --> Cleanup: teardown
  Playing --> Cleanup: stop/navigate
  Paused --> Cleanup: stop/navigate
  Cleanup --> Idle: resources released
```

| Transition | Timers | Media | WebGL | Canvas | Listeners | HLS | Audio |
|------------|--------|-------|-------|--------|-----------|-----|-------|
| Idle→Loading | start heartbeat if tracked | preload intentional | none (Hamsa lazy) | mount DOM | add | create on source | prepare |
| Playing→Paused | keep session clock paused | pause decode | stop loops / dispose Hamsa on stop | hold last frame | keep | keep buffered | pause |
| Playing→Hidden | skip heartbeat | pause nonessential | stop loops | hold | keep | pause | pause |
| Hidden→Visible | resume heartbeat | soft-resume | resume if playing | redraw | keep | resume | resume |
| *→Cleanup | clear | destroy/reset | loseContext | clear | remove tracked | destroy | dispose |
| Cleanup→Idle | none | none | 0 | static | baseline | 0 | 0 |
