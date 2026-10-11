# Lean RFB — remaining gaps

> Date: 2026-10-12 (Asia/Shanghai)  
> Default runtime is **self-built** `RfbSession` / `SVNCClient`. Wrap / `@novnc/novnc` is **not** a dependency.

## Shipped

| Area | Status |
|------|--------|
| RFB 3.8 handshake | None + VNC Auth |
| Encodings | **Raw**, CopyRect, **RRE**, **Hextile**, **ZRLE**, **Tight** (fill / copy / palette / **gradient** / **JPEG**) |
| Tight zlib | **Stateful** raw-deflate pool (4 streams) via `fflate` |
| ZRLE zlib | Persistent / per-rect zlib inflate via `ZrleInflater` |
| Cursor pseudo-encoding (−239) | **Soft cursor** overlay (FB for Agent screenshots stays clean) |
| DesktopSize (−223) | Resize + `desktopsize` event |
| ExtendedDesktopSize (−308) | Parse screen layout, resize FB, `extendeddesktopsize` event + `screenLayout` |
| Input | Pointer (incl. wheel), KeyEvent, typeText, clipboard write |
| Display | Canvas framebuffer, screenshot / toDataURL / frame+damage events |
| Human input | Optional canvas DOM → RFB (`human` / `mixed`) |

## Closed this pass

| Gap | Resolution |
|-----|------------|
| **Tight JPEG** | Decode via `jpeg-js` (Node) or `createImageBitmap` / `<img>` (browser); no soft-skip |
| **Tight zlib stream state** | `TightInflatePool` + `RawDeflateStream` (fflate `Inflate`, 4 streams, reset bits) |
| **ZRLE / Hextile / RRE** | Full decoders; advertised in `SetEncodings` |
| **Cursor pseudo-encoding** | Soft cursor on canvas; Agent `screenshot`/`toDataURL` omit overlay |
| **ExtendedDesktopSize** | Parse + resize; multi-monitor layout retained in `screenLayout` |
| **Continuous Tight without Raw** | Default preference order starts with Tight; QualityLevel 7 advertised; JPEG + stateful zlib make Tight-only viable |

## Deferred (out of SVNC scope / matrix)

| Gap | Reason |
|-----|--------|
| **VeNCrypt / RA2 / TLS** | **外围优先**（WSS/VPN/SSH/原生 WSS）；非 SVNC 核心。仅当 Server **强制**该 RFB security type 且无法用外围替代时再评估。见 [peripheral-security.md](./peripheral-security.md)；[compat-matrix](./compat-matrix.md) 保持 ❌ |
| **SetDesktopSize client→server** | Optional follow-on once a product story needs client-initiated layout changes; receive path for ExtendedDesktopSize is done |
| **Mobile scaleViewport** | Post-MVP (product non-goal) |
| **Self-built websockify** | Reuse upstream / native WS VNC ([websockify-decision](./websockify-decision.md)) |
| **Built-in OCR / HTTP Vision** | D3: screenshot API only; Agent brings its own vision |

## Non-goals (still)

- Shipping `@novnc/novnc` or Wrap as default
- Self-built websockify product
- Mobile scaleViewport (post-MVP)
- Built-in recognition providers (D3)

Historical Wrap adapter: [`examples/archive/novnc-legacy.ts`](../examples/archive/novnc-legacy.ts).
