# Falsification Results

| Attack | Result | Release-blocking? |
|--------|--------|-------------------|
| Amrita double-start duplicate loops | PASS (still 1) | n/a |
| Amrita pause leaves rAF | PASS (0 loops) | n/a |
| Amrita hidden leaves rAF | PASS (paused, 0) | n/a |
| Hamsa idle WebGL contexts | PASS (lazy init) | n/a |
| Claim Full GO without Safari Energy Impact | FAIL intentional | Yes — keeps CONDITIONAL |
| Remove two-pass / change timing | Not attempted | n/a |

Independent stance: implementation claims for loop/context invariants are supported by behavioral smoke; thermal Energy Impact claims are **not** fully evidenced.
