# Adaptive Activity State

`idle | page-active | session-active | hidden | disposed`

Manager is sole authority. Surfaces emit `sessionStarted` / `sessionStopped` / `routeActive`.

| State | Sampling |
|-------|----------|
| idle | Off |
| page-active | Low frequency |
| session-active | 1–2s samples |
| hidden | Throttled; recovery frozen |
| disposed | Off; observers disconnected |
