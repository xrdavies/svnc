# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] — 2026-10-13

### Added

- **Apple Remote Desktop authentication** (RFB security type 30) for macOS Screen Sharing. When `credentials` has both `username` and `password` and the server offers type 30, SVNC signs in as that macOS user and lands in the user's session instead of the login window. Diffie-Hellman via `BigInt`, MD5 and AES-128-ECB (from WebCrypto AES-CBC) in `src/rfb/ard.ts`. Needs WebCrypto (secure context: `https`/`wss`, `localhost`, or Tauri/Electron).

## [0.1.0] — 2026-10-12

First public release of **@xrdavies/svnc** (Simple VNC): lean browser RFB client with Agent-friendly Automation APIs.

> npm package name is scoped (`@xrdavies/svnc`) because unscoped `svnc` was rejected by the registry for similarity to existing packages.

### Added

- Lean RFB over WebSocket: protocol 3.8 handshake, **None** + **VNC Authentication**
- Encodings: Raw, CopyRect, RRE, Hextile, ZRLE, Tight (fill / copy / palette / gradient / JPEG + stateful zlib)
- Pseudo-encodings: Cursor (soft cursor), DesktopSize, ExtendedDesktopSize (receive path)
- `SVNCClient` Automation API: screenshot / toDataURL, move/click/drag/scroll/typeText, frame+damage events, inputMode
- Recognition hooks: `RecognitionProvider` interface + stubs; Agent brings its own vision (D3)
- Examples: full [demo](./examples/demo/), lite page, Agent screenshot / GitHub nav, optional non-production WS↔TCP bridge
- Docs: roadmap (P0–P5), design, compat matrix, peripheral security (D7), threat model, e2e-local; user/dev guides (quick start, Automation API, architecture index)
- CI recipe: typecheck, unit tests, build ([docs/ci.md](./docs/ci.md); enable Actions workflow when the pushing token has `workflow` scope)
- License: MIT

### Security

- Transport encryption is **out of band** (WSS / VPN / SSH); RFB VeNCrypt/RA2 not implemented by design (D7)
- See [docs/security.md](./docs/security.md)

[0.1.0]: https://github.com/xrdavies/svnc/releases/tag/0.1.0
