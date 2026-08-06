# 02 — Failure Taxonomy

Canonical stages and codes live in `web/src/features/rayd8-player/sessionStartupTaxonomy.ts`.

Overlay selection priority:
1. Soft denial (entitlement/access/trial)
2. Offline / auth expired
3. Media-start failure (health hard fallback after media ownership)
4. Init failure (token/asset/controller/source before ownership)

User copy never exposes HLS/Mux/JWT/MediaSource. Support reference: `R8-XXXX`.
