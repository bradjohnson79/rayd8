# 04 — Health Guard After

| Topic | After |
|---|---|
| Start | Hard/soft timers arm only when `mediaOwned && sourceApplied` and not paused |
| States | Explicit reducer in `playbackHealthStateMachine.ts` |
| Hidden/offline/autoplay | Pause timers; resume with fresh deadlines |
| Audio-only predicate | Progress on audio element; no videoWidth |
| Dual | Video required; audio only if `audioRequired` |
| Combined | Video predicate on single AV element |
| Autoplay blocked | `WAITING_FOR_AUTOPLAY` — nonfatal |
| Retry | Force destroy + `forceReload` media path |

Constants unchanged: soft 5s, hard 9s, poll 500ms (observed windows retained; arming gated).
