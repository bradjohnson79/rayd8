# Health guard semantics (observe-only)

Constants: SOFT 5000ms, HARD 9000ms, POLL 500ms

Healthy: !paused && readyState>=HAVE_CURRENT_DATA && videoWidth>0 && currentTime>0.5

Enabled when !activeSoftDenialState

resetKey: sessionType:videoMode:audioTrack:initRetryKey

StrictMode: DEV double-invoke; cleanup clears timers

Visibility: guard does not pause itself; mobile lifecycle may pause video → fails healthy

Token refresh: does not reset health timers via resetKey
