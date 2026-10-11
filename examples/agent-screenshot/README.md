# Agent example — screenshot API (D3)

SVNC does **not** ship a mandatory HTTP Vision / OCR provider in Phase 4.
Agents should:

1. `connect` (non-viewOnly)
2. `screenshot()` / `toDataURL()` / `toBlob()`
3. Analyze pixels with **their** model / heuristics
4. Call `click` / `typeText` / `drag` / …

See `example.ts` for a typed sketch. Optional `RecognitionProvider` + `waitFor` / `clickTarget` exist as stubs if you later plug in a provider.
