# Stage classification at health-fallback overlay

| Stage | Status | Notes |
|---|---|---|
| Authentication | Success (typical) | Else soft-denial suppresses overlay |
| Access/entitlement | Success (typical) | Pre-mount gated |
| Backend `/session/start` | Unknown/Success | Concurrent; not required for overlay |
| Player mount | Success | Required to show overlay |
| Mux token | Success or Failure | Failure may still end in health path |
| Media source | Success or Failure | |
| Media readiness | Failure/Incomplete | Defining feature of this overlay |
| Health guard observation | Failure | `status=failed` |
