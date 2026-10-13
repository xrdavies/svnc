# SVNC

**Simple VNC** — a browser VNC client with **Agent-friendly screenshot and input APIs**.

Inspired by [noVNC](https://github.com/novnc/noVNC), with a lean self-built RFB path and a frozen Automation contract so programs (not only humans) can operate a remote desktop.

**npm:** `@xrdavies/svnc@0.1.0` · **License:** MIT

## Product goals

1. Use it in a **web page** for basic VNC (connect, display, human keyboard/mouse).
2. Expose APIs for **screenshot + keyboard/mouse** (and optional recognition hooks) so **AI Agents** can automate remote UIs.
3. Mobile scaling / gestures are **out of scope** for now.

## Status (Phases 0–5)

| Phase | Status |
|-------|--------|
| P0 decisions (MIT, `@xrdavies/svnc`, Raw→Tight, screenshot-first, non-viewOnly, **D7 peripheral TLS**) | Done |
| P1 Wrap Spike (frozen Automation types; Wrap retired) | Done |
| P2 Lean RFB (WS, none/VNCAuth, encodings, Canvas) | Done |
| P3 frame/damage, drag/scroll/dblclick, inputMode, errors, clipboard docs | Done |
| P4 RecognitionProvider + stubs + Agent examples | Done (no built-in vision — D3) |
| P5 productization (ESM/types, CI, lite page, security docs, `0.1.0`) | Done |

## Install

```bash
npm install @xrdavies/svnc
```

Requires a browser (or JSDOM-like) environment with **WebSocket** + **Canvas**, and a VNC path reachable as WebSocket (websockify or native WS VNC).

> **Transport:** SVNC does **not** support `vnc://` (or bare TCP RFB) in the browser. The connect URL must be **`ws://` or `wss://`**. Classic TCP VNC needs [websockify](https://github.com/novnc/websockify) (or a VNC server that speaks WebSocket natively). See [docs/websockify-decision.md](./docs/websockify-decision.md).

## Quick API sketch

Full reference: [Automation API](./docs/automation-api.md). Step-by-step: [Quick start](./docs/quick-start.md).

```ts
import { SVNCClient } from '@xrdavies/svnc';

const client = await SVNCClient.connect(document.getElementById('screen'), {
  url: 'ws://127.0.0.1:6080/',
  credentials: { password: 'secret' }, // optional VNC Auth
  viewOnly: false, // required for click/typeText (D6)
});

const snap = client.screenshot(); // Agent analyzes snap.imageData / toDataURL()
client.click(120, 80);
await client.typeText('hello');
client.on('frame', ({ damage }) => { /* observe updates */ });
client.disconnect();
```

SVNC does not ship a bridge product; use upstream **websockify** (or native WS VNC) for TCP targets.

Production encryption: prefer **WSS reverse proxy / VPN / SSH** — not RFB VeNCrypt (**D7**). See [docs/peripheral-security.md](./docs/peripheral-security.md) and [docs/security.md](./docs/security.md).

## Examples

| Path | Purpose |
|------|---------|
| [examples/lite/](./examples/lite/) | Minimal viewer (vnc_lite-style) |
| [examples/demo/](./examples/demo/) | Full Automation + human input demo |
| [examples/agent-screenshot/](./examples/agent-screenshot/) | Screenshot → Agent loop sketch |
| [examples/agent-github-nav/](./examples/agent-github-nav/) | Scripted Chrome navigation over SVNC |
| [examples/ws-tcp-bridge/](./examples/ws-tcp-bridge/) | **Non-production** tiny WS↔TCP lab bridge |

## Docs

Index: **[docs/README.md](./docs/README.md)**

| Doc | Audience |
|-----|----------|
| [Quick start](./docs/quick-start.md) | Users — install, local e2e, minimal connect |
| [Automation API](./docs/automation-api.md) | Users / Agents — `SVNCClient`, events, errors |
| [Architecture](./docs/architecture.md) | Devs — module map ↔ `src/` |
| [Local e2e](./docs/e2e-local.md) | Devs — Linux full stack; macOS `demo:serve` |
| [Compat matrix](./docs/compat-matrix.md) | Devs — Server / Auth / Encoding |
| [Roadmap](./docs/roadmap.md) | Planning — Phases + decisions D1–D7 |
| [Design proposal](./docs/design-proposal.md) | Planning — vision / early draft |
| [Peripheral security](./docs/peripheral-security.md) | Deploy — WSS / VPN / SSH (**D7**) |
| [Security](./docs/security.md) | Embedders — Automation threat model |
| [Clipboard](./docs/clipboard.md) | Users — `clipboardWrite` / `viaClipboard` |
| [Lean RFB gaps](./docs/lean-rfb-gaps.md) | Devs — done vs deferred |
| [websockify decision](./docs/websockify-decision.md) | Deploy — reuse bridge |
| [npm 手动发布](./docs/npm-publish.md) | Maintainers |
| [CI](./docs/ci.md) | Maintainers |
| [Changelog](./CHANGELOG.md) | Everyone |

## Develop

```bash
npm install
npm test
npm run build
```

### Local demo / e2e

**Linux** (Xvfb + x11vnc + websockify):

```bash
npm run build
npm run e2e:start
# lite:  http://127.0.0.1:8080/examples/lite/
# demo:  http://127.0.0.1:8080/examples/demo/
# password: svnc-demo · WS: ws://127.0.0.1:6080/
npm run e2e:verify
npm run e2e:stop
```

**macOS / Windows** (static Demo only; bring your own VNC WebSocket):

```bash
npm run build
npm run demo:serve   # alias: npm run e2e:demo
# open http://127.0.0.1:8080/examples/demo/
# set WebSocket URL to ws://… or wss://… (Docker / remote / local websockify)
```

Details: [docs/e2e-local.md](./docs/e2e-local.md).
