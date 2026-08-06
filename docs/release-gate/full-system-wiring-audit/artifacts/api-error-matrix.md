 (static + short intercept intent)

| Condition | Likely UI | Retry freshness | Stuckness risk |
|---|---|---|---|
| 401 access | Dashboard / soft denial | New token needed | Medium if Clerk UI still signed-in |
| 403 entitlement | Soft denial / upgrade | New session won't help without plan | Low if soft denial shown |
| 404 asset/token | Init failure / health path | Try Again refetches token | Medium |
| 409/422 | Soft denial / error message | Depends on code | Medium |
| 429 | Error/init | Retry may rehit limit | Medium |
| 5xx | Init failure or soft denial | Try Again new request | Medium |
| Timeout / abort | Health fallback if media never healthy | Try Again new init effect | **High** — mislabeled overlay |
| Malformed/empty JSON | Init catch → initFailureVisible | Try Again | Medium |

