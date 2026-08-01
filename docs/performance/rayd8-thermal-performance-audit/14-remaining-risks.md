# Remaining Risks

1. **Clerk marketing payload** still dominates logged-out LCP.
2. **`/rayd8-mark.png` ~273 KB** is now a top transfer; compress/replace.
3. **SessionProvider monolith** still rerenders player on usage heartbeat.
4. **Safari Energy Impact / 30-min soak** evidence incomplete.
5. **Audio resume** relies on authority soft-resume after hide; needs Safari smoke.
6. **Performance presentation** changes Express look (no CSS brightness) — restore via env if product requires cinematic.
7. **401 token recovery** no longer force-refreshes; monitor auth soft-denial rates.
8. Reanimated `useFrameCallback` still registered while Hamsa idle (early-returns; low cost vs WebGL).
