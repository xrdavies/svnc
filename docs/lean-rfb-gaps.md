# Lean RFB — remaining gaps

> Date: 2026-10-12 (Asia/Shanghai)  
> Default runtime is **self-built** `RfbSession` / `SVNCClient`. Wrap / `@novnc/novnc` is **not** a dependency.

## Shipped (enough for Automation MVP)

| Area | Status |
|------|--------|
| RFB 3.8 handshake | None + VNC Auth |
| Encodings | **Raw** (preferred), CopyRect, Tight (fill / copy / palette); DesktopSize, LastRect |
| Input | Pointer (incl. wheel bits), KeyEvent, typeText, clipboard write |
| Display | Canvas framebuffer, screenshot / toDataURL / frame+damage events |
| Human input | Optional canvas DOM → RFB (`human` / `mixed`) |

## Known gaps (backlog)

| Gap | Impact | Mitigation now | Next |
|-----|--------|----------------|------|
| **Tight JPEG** | Some servers send JPEG Tight rects | Soft-skip payload + re-advertise Raw + full refresh; QualityLevel0 advertised | Optional decode via `createImageBitmap` / JPEG decoder |
| **Tight zlib stream state** | Fresh `DecompressionStream` per rect may diverge from continuous zlib streams | Prefer Raw; palette/fill paths common on x11vnc | Stateful inflate per stream id |
| **ZRLE / Hextile / RRE** | Not decoded | Not advertised | Add only with matrix row |
| **Cursor pseudo-encoding** | No local cursor overlay | Not advertised; if received, payload consumed | Optional soft cursor |
| **ExtendedDesktopSize / multi-monitor** | No layout | DesktopSize only | When needed |
| **VeNCrypt / RA2 / TLS** | Auth beyond VNC Auth | Out of scope | Matrix-driven |
| **Continuous Tight without Raw** | Bandwidth-heavy Raw on WAN | OK for local Agent / demo | Improve Tight + JPEG |

## Non-goals (still)

- Shipping `@novnc/novnc` or Wrap as default
- Self-built websockify product
- Mobile scaleViewport (post-MVP)

Historical Wrap adapter: [`examples/archive/novnc-legacy.ts`](../examples/archive/novnc-legacy.ts).
