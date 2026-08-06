# Browser blocking report (short)

## Lab browsers

| Browser | Result |
|---|---|
| Chromium | Home 200; dashboard → Clerk sign-in; Umami script tag present |
| Firefox | Home 200; Clerk cookie domain warnings in headless |
| WebKit | Home 200; CSP blocked vercel.live feedback script (noncritical) |
| Brave | **Not installed** — Shields matrix CONDITIONAL |

## Umami block simulation (Chromium route.abort)

- Blocked `**/umami*` with `blockedbyclient`
- Observed `net::ERR_BLOCKED_BY_CLIENT.Inspector` on first-party umami chunk
- Page status remained 200; zero `pageerror` events
- Supports noncritical classification for analytics blocking under Brave-like Shields

## Authenticated media CDN block

Not exercised live (no auth). Static classification: Mux playlist/segment `ERR_BLOCKED_BY_CLIENT` → playback-health / init class, not access denial.
