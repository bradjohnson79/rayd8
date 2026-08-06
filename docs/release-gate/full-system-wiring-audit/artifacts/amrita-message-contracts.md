

| Message type | Sender | Receiver | Payload | Origin validation | Response / timeout / cleanup |
|---|---|---|---|---|---|
| `rayd8:adaptive-performance:v1` `applyProfile` | Parent (`adaptivePerformanceBridge` / lifecycle) | Amrita iframe | `{ type, action:'applyProfile', profile: EffectivePerformanceProfile }` | Sender `targetOrigin=location.origin`; receiver `event.origin === location.origin` | No ack/timeout; parent unregisters iframe on cleanup; iframe listener is sticky once installed |
| Session/auth control | — | — | **None via postMessage** | — | Amrita auth uses same-origin `window.parent` Clerk access in `audio-layer.js` |
| `__AMRITA_SOAK__` | Iframe self | Test harness | Probe API methods | N/A (not messaging) | Not used by production parent route |

### Protocol checks

| Check | Result |
|---|---|
| Messages not sent before iframe ready | Parent registers on iframe ref/load lifecycle |
| Parent validates origin | Yes (targetOrigin) |
| Iframe validates parent origin | Yes |
| Listeners removed on exit | Parent unregister yes; iframe listener remains for document lifetime |
| Old iframe cannot answer new session | No request/response protocol; stale iframe would only apply profiles if still registered |
| Missing ack blocks indefinitely? | **No** — fire-and-forget |
| Brave blocks path? | Same-origin postMessage; Shields more likely to affect third-party scripts than this channel |

