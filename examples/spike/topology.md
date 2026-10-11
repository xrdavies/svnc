# Demo topology: TigerVNC + websockify

SVNC does **not** ship a production WebSocket↔TCP bridge. Reuse [websockify](https://github.com/novnc/websockify) (or a VNC server with native WebSocket).

## Recommended

| Component | Role | Notes |
|-----------|------|-------|
| Xvfb / real X | Framebuffer | 1280×720 sufficient for Spike |
| TigerVNC (`x0vncserver` / `vncserver`) | RFB TCP | Auth: **none** or **VNC Auth** |
| websockify | WS ↔ TCP | e.g. `websockify 6080 localhost:5901` |
| SVNC browser page | Client | `ws://127.0.0.1:6080/` |

## Security reminder

Do not expose websockify to the public Internet without authentication / target allowlists. Demo binds to localhost.

## Encoding

Client requests **Tight**, **Raw**, **CopyRect**. Raw is the Phase 1/2 must-pass; Tight is Phase 2 extension (D2).
