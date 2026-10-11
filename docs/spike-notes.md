# Phase 1 Wrap Spike — notes

> Date: 2026-10-12 (Asia/Shanghai)

## What shipped

- Frozen Automation contract: `src/automation/types.ts` + `SvncError` model
- Isolated Wrap adapter: moved to `examples/archive/novnc-legacy.ts` (retired from default path)
- Spike docs + static demo page under `examples/spike/`
- Local topology: TigerVNC + **upstream websockify** (no SVNC bridge product)

## Environment caveat

This agent environment did **not** assume a running TigerVNC/websockify stack. Integration “green” against a live RFB server is **not** claimed in CI. Unit tests cover pure logic (keysym, errors, DES challenge encrypt, transport buffer helpers).

## Lessons → Phase 2 trigger

| Observation | Implication |
|-------------|-------------|
| Pointer requires private noVNC API | Wrap remains fragile; lean RFB must own PointerEvent |
| No public `frame` event on noVNC | Lean client emits `frame` with damage list (Phase 3) |
| scaleViewport breaks Agent coords | Demo forces desktop pixels; document in topology |

## Exit checklist

1. ✅ Automation types committed  
2. ✅ Adapter boundary clear (`novnc-legacy` only)  
3. ⚠️ Live “screenshot → click → typeText → screenshot” needs local VNC (documented)  
4. ✅ Decision: proceed to lean RFB as default (`SVNCClient`)

## Deprecation

Phase 2 lean path is default. `novnc-legacy` is archived; **no** `@novnc/novnc` runtime dependency.
