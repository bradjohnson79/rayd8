# RAYD8 iPad Safari FireTV Compatibility Repair Report

Date: June 10, 2026

## Scope

This repair addressed customer-reported compatibility issues around iPad Safari/WebKit, FireTV browser behavior, Apple TV mirroring, persistent purchase prompts, and sign-in friction.

The repair did not change billing logic, subscription entitlement rules, Stripe checkout pricing, or usage limits.

## Summary Of Fixes

### 1. Paid-User Landing Page Purchase Prompts

Authenticated users could see public landing-page purchase CTAs such as `Start Free Trial`, `Experience REGEN`, and `Start Amrita Membership` even after sign-in.

Fixes applied:

- Added DB-backed landing membership hydration through `/v1/me`.
- Replaced public hero CTAs with `Go to Dashboard` for signed-in users.
- Replaced landing pricing cards with a dashboard handoff for signed-in users.
- Prevented the navbar from assuming users are signed out while Clerk is still loading.

Key files:

- `web/src/features/landing/useLandingMembership.ts`
- `web/src/features/landing/HeroSection.tsx`
- `web/src/features/landing/TeaserSection.tsx`
- `web/src/features/landing/NavbarAuthCluster.tsx`
- `web/src/features/landing/LandingNavbar.tsx`

### 2. Dashboard And Sidebar Upsell Flash

Dashboard plan-sensitive UI could briefly rely on Clerk metadata before `/v1/me` confirmed the real DB-backed membership. If Clerk metadata lagged behind the database, paid users could briefly see free-plan or upgrade messaging.

Fixes applied:

- Hydrated the dashboard shell/sidebar plan from `/v1/me`.
- Suppressed free-plan sidebar upgrade items until membership is confirmed.
- Deferred dashboard Amrita banners, trial banners, upgrade cards, HAMSA visibility, and Amrita sections until DB-backed membership/access data is available.
- Changed session CTAs to neutral `Checking access...` copy during membership hydration.

Key files:

- `web/src/features/dashboard/DashboardLayout.tsx`
- `web/src/features/dashboard/Sidebar.tsx`
- `web/src/features/rayd8-dashboard/Rayd8Dashboard.tsx`

### 3. iPad Safari Sign-In Handoff

The mobile drawer previously closed and opened Clerk sign-in in the same action path, which can be fragile on iPad Safari because modal rendering, scroll locking, and user gesture timing are sensitive.

Fixes applied:

- Added an auth-loading state to the mobile menu.
- Closed the mobile drawer before opening Clerk sign-in/sign-up.
- Delayed Clerk modal opening slightly so it does not compete with the drawer transition.

Key files:

- `web/src/components/MobileMenu.tsx`
- `web/src/features/landing/LandingNavbar.tsx`

### 4. FireTV / Silk Browser Playback Fallback

FireTV Silk can lack reliable HLS/MSE support for the current RAYD8 playback stack. Previously this could surface as a generic stream failure or confusing initialization failure.

Fixes applied:

- Added FireTV/Silk user-agent detection for unsupported stream errors.
- Replaced the generic HLS unsupported error with clear guidance for FireTV users.
- Surfaced the compatibility error directly in the central player initialization overlay.

Key files:

- `web/src/features/rayd8-player/mediaController.ts`
- `web/src/features/rayd8-player/Rayd8PlayerEngine.tsx`

### 5. Apple TV Mirroring / External Display Stability

The mobile playback lifecycle treated `window.blur` like a hard hidden/background event. External display and mirroring transitions can trigger blur even when playback should continue on the source device.

Fix applied:

- Removed `window.blur` as a mobile playback hard-interruption trigger.
- Kept `visibilitychange`, `pagehide`, `pageshow`, and `focus` as the lifecycle signals.

Key file:

- `web/src/features/rayd8-player/useMobilePlaybackLifecycle.ts`

## Playback Architecture Findings

RAYD8 playback is not served from a single private video server.

The architecture is:

- The frontend app is hosted separately from the API.
- The API validates account access and issues secure signed playback tokens.
- Mux/CDN handles the actual video streaming delivery.
- Session heartbeats and usage tracking run through the API while playback streams from Mux.

## Validation Performed

Completed validation:

- Ran production web build: `npm --prefix web run build`
- Confirmed the build passed.
- Checked IDE diagnostics for edited files; no linter errors were reported.
- Verified locally in an iPad-sized preview that signed-in landing users see `Go to Dashboard` instead of public purchase CTAs.
- Verified the signed-in teaser/pricing section suppresses plan purchase cards and shows a dashboard handoff.

## Remaining Device Validation

Physical device confirmation is still recommended for:

- iPad Safari
- iPad Firefox and DuckDuckGo, which are WebKit wrappers
- FireTV Silk browser
- Apple TV mirroring / AirPlay

Expected outcome after this repair:

- Paid users should no longer see public purchase prompts or free-plan upgrade flashes while membership data hydrates.
- iPad sign-in should have fewer modal/drawer conflicts.
- Unsupported FireTV playback should show clear guidance instead of failing silently or generically.
- Apple TV mirroring should be less likely to trigger false playback interruption from blur events.

