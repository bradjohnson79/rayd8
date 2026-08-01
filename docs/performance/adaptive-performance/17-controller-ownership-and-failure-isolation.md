# Controller Ownership and Failure Isolation

## Registration

```ts
const unregister = registerRuntimeController(controller)
// on dispose:
unregister()
```

Invariant: **at most one active controller per id**. Remount ×10 must not accumulate (unit-tested).

## Dispatch

Each `applyProfile` is try/caught. Failures are rate-limited. One failure never blocks other surfaces.

## Production controllers

| ID | Path |
|----|------|
| `hamsa` | Versioned postMessage bridge + optional probe |
| `amrita` | Versioned adapter (`rayd8:adaptive-performance:v1`) |
| `ambient` | Tier → cinematic/balanced/minimal; session-active → minimal |
| `express-media` | Separate network policy with residence times |
