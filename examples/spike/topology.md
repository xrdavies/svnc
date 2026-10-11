# Demo topology: VNC + websockify

SVNC does **not** ship a production WebSocket↔TCP bridge. Reuse [websockify](https://github.com/novnc/websockify) (or a VNC server with native WebSocket).

## Recommended (matrix)

| Component | Role | Notes |
|-----------|------|-------|
| Xvfb / real X | Framebuffer | 1280×720 sufficient |
| TigerVNC | RFB TCP | Auth: **none** or **VNC Auth** (preferred matrix server) |
| websockify | WS ↔ TCP | e.g. `websockify 6080 localhost:5901` |
| SVNC browser page | Client | `ws://127.0.0.1:6080/` |

## Box local e2e (this repo)

On environments without TigerVNC packages, use **x11vnc** against Xvfb — see **[docs/e2e-local.md](../../docs/e2e-local.md)** and `./scripts/local-e2e/start.sh`.

| Port | Service |
|------|---------|
| `:99` | Xvfb |
| `5901` | x11vnc (VNC Auth, password `svnc-demo`) |
| `6080` | websockify |
| `8080` | static HTTP (demo) |

## Security reminder

Do not expose websockify to the public Internet without authentication / target allowlists. Demo binds to localhost.

## Encoding

Client requests **Raw**, **Tight**, **CopyRect** (Raw first for compatibility). Raw is the Phase 1/2 must-pass; Tight is Phase 2 extension (D2).
