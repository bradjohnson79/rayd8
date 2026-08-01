# Policy Rules

Terminology: stress = **downgrade**; health = **recover**.

- Automatic: start standard; downgrade under sustained stress; recover one tier at a time
- Standard: stay standard (failure fallback only for init/stability failures)
- Reduced: force reduced
- Ordinary max ≤1 change / ~30s; max 4 ordinary / session
- Downgrade residence ≥20–30s; recovery ≥60–120s
- Emergency downgrade may bypass downgrade residence
