# ws-tcp-bridge (lab only)

Tiny Node WebSocket ↔ TCP forwarder for local experiments.

**Not a production bridge.** No TLS, no token auth, no path routing, no hardening.
Default recommendation remains [websockify](https://github.com/novnc/websockify) or a native WebSocket VNC server — see [docs/websockify-decision.md](../../docs/websockify-decision.md).

```bash
# requires `ws` (devDependency of this repo)
node examples/ws-tcp-bridge/bridge.mjs 6081 127.0.0.1 5901
# then point SVNC at ws://127.0.0.1:6081/
```

For encrypted public access, put **WSS** in front of websockify (or use VPN/SSH) — [docs/peripheral-security.md](../../docs/peripheral-security.md) (D7).
