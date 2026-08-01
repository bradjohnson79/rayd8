# Manager Overhead Results

| Check | Result |
|-------|--------|
| High-frequency timer while idle | None (sampler idle = no rAF/interval) |
| Observers after dispose | Disconnected |
| React rerenders per sample | Manager outside React; subscribers only on profile changes |
| Controller failure flood | Rate-limited logging |

Bundle delta not gated as a hard CI budget in this pass; structure keeps sampler/policy/manager split to avoid mega-class cost.
