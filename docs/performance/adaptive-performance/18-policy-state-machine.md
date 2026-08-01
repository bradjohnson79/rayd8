# Policy State Machine

```text
Automatic / Standard / Reduced
        ↓
Effective tier (standard | balanced | reduced)
        ↓
Profile v1
        ↓
Independent controllers (hamsa, amrita, ambient, express-media)
        ↓
Runtime registry evidence
```

Automatic only:

```text
standard --downgrade--> balanced --downgrade--> reduced
reduced  --recover---> balanced --recover---> standard
```

Hidden freezes ordinary transitions. Emergency critical stress may bypass downgrade residence.
