# Support Guide — Session Startup Incidents

Look for Umami event `session_startup_incident` with:
- `stage`, `code`, `referenceCode` (R8-XXXX)
- `sessionIdPresent`, `sourceApplied`, `healthGuardState`
- `documentVisibility`, `online`, `autoplayPending`

Interpret:
- AUTH_* → ask user to sign out/in
- ENTITLEMENT_* → plan/usage soft denial (not a media bug)
- PLAYBACK_TOKEN_* / init stages → preparation failure
- MEDIA_START_TIMEOUT after sourceApplied → media-start class
