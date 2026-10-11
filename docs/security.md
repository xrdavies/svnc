# SVNC security model (Automation API)

> Date: 2026-10-12 (Asia/Shanghai)  
> Related: [peripheral-security.md](./peripheral-security.md) (transport encryption, D7), [roadmap.md](./roadmap.md)

## 1. Threat model (short)

SVNC is a **browser (or Agent-driven) RFB client**. Anyone who can call its Automation API can **see the remote desktop and inject keyboard/mouse** — equivalent to a logged-in interactive VNC session when `viewOnly: false`.

| Asset | Risk if exposed |
|-------|-----------------|
| WebSocket URL to VNC/bridge | Session hijack / desktop takeover |
| VNC password / credentials | Auth bypass on the RFB hop |
| `screenshot` / frame events | Sensitive UI content leakage |
| `click` / `typeText` / clipboard | Arbitrary remote UI actions |

**Out of library scope (deployer responsibility):** terminating TLS, network ACLs, identity at the HTTP edge, OS hardening of the VNC host. Prefer **WSS reverse proxy / VPN / SSH** — see [peripheral-security.md](./peripheral-security.md) (**D7**: no VeNCrypt/RA2/RFB-TLS in SVNC by default).

## 2. Hardening checklist for embedders

1. **URL allowlist** — only connect to known `ws:`/`wss:` endpoints (your bridge / gateway). Do not pass untrusted user-supplied URLs straight into `SVNCClient.connect`.
2. **Prefer `wss://` in production** — terminate TLS at nginx/Caddy/Traefik or a native WSS VNC; keep VNC Auth on the inner hop if needed.
3. **Credentials** — never hard-code production passwords in front-end bundles; inject via short-lived secrets or server-side session minting. Demo password `svnc-demo` is for local e2e only.
4. **`viewOnly`** — use `true` for watch-only surfaces; Automation MVP and Agent demos require `false` (D6) — treat those pages as privileged.
5. **`inputMode`** — `script` blocks DOM human input (good for unattended Agent); `mixed`/`human` are for operators. Document which mode each page uses.
6. **Audit hooks** — wrap Automation calls (`click`, `typeText`, `clipboardWrite`, connect/disconnect) with your own logging/metrics before calling SVNC.
7. **Origin / CSP** — serve the control page over HTTPS; restrict who can load the page that holds the live client.
8. **Shared sessions** — multiple controllers on one desktop will race; use locking or a single Agent owner.

## 3. What SVNC does not do

- Does not implement VeNCrypt / RA2 / RFB-layer TLS (D7).
- Does not ship a production WebSocket↔TCP bridge (reuse websockify; optional lab bridge under `examples/ws-tcp-bridge/`).
- Does not sandbox the remote OS — RFB compromise ≈ local input on that desktop.

## 4. Reporting

Security issues: open a private report to the repository maintainers (`xrdavies` / project owners) rather than filing a public issue with exploit detail.
