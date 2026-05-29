# RAYD8 Express Clerk Persistence

RAYD8 Express uses the existing Clerk web session. Clerk remains the sole authentication
authority for Express. Do not add custom credential storage, password persistence, or
long-lived local tokens for Express.

To support the product requirement that users stay signed in for 30+ days, verify both
settings in the Clerk Dashboard:

- Session Lifetime: at least 30 days
- Inactivity Timeout: at least 30 days

The web app launches Express at `/dashboard?source=express`. If Clerk still has a valid
session, the existing dashboard guard restores the user directly into the dashboard. If
Clerk reports the session is expired or signed out, the existing sign-in redirect flow is
used.
