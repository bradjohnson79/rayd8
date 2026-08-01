# Previous Repair Verification

| Repair | Status | Implementation | Test type | Notes |
|--------|--------|----------------|-----------|-------|
| R-T1 Hamsa idle WebGL loops | VERIFIED + REFINED | Lazy `ensureGl` only when `isPlaying` | static + probe | Idle contexts now 0 before START |
| R-T2 Amrita paused rAF | VERIFIED + REFINED | Hard-stop + double-start guard + `activeVisualLoops` | **behavioral** smoke PASS | |
| R-T3 Desktop hidden media pause | VERIFIED | `enabled: isActive` + pause video/audio | static + prior mux lifecycle | |
| R-T4 Dashboard ambient under session | VERIFIED | `ambientProfile=minimal` when session active | static | CSS ambient, not video |
| R-T6 Token cache | VERIFIED + REFINED | Default cache; `forceRefresh` opt-in only | static | |
| R-T7 Performance presentation | VERIFIED | Default performance | static | |
| R-T9 Hero still | VERIFIED | `RAYD8_Hero.png` 52KB | budget gate | |

String-scan guards remain as preflight. Behavioral release gate: `npm run test:thermal-behavior` + `test:thermal-budgets`.
