# Resource Ownership Matrix

| Resource | Owner | Created | Destroyed |
|----------|-------|---------|-------------|
| HLS Player | Express Player | Session Start / source load | Session Stop / unmount |
| Video element | Express Player | Session Start | Session Stop |
| RAF Loop | Amrita | Start / Resume | Pause / Stop / Complete |
| WebGL Context | Hamsa Aura / Glyph / Hand | First Start | Stop dispose / Route Exit |
| Audio element | Session audio layer | Play / unlock | Dispose / session end |
| Ambient CSS layers | DashboardShell / BackgroundSystem | Route mount | Session-active downgrade / unmount |
| Usage heartbeat timer | SessionProvider | Active tracked session | Hidden skip / session end |
| Runtime diagnostics | Runtime diagnostics | DEV/admin mount | Panel close / unmount |

Owner strings must match `RuntimeOwner` in `runtimeResourceRegistry.ts`.
