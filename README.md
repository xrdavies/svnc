# SVNC

**Simple VNC** — a browser VNC client with **Agent-friendly screenshot and input APIs**.

Inspired by [noVNC](https://github.com/novnc/noVNC), with a lean self-built RFB path and a frozen Automation contract so programs (not only humans) can operate a remote desktop.

**npm:** `svnc@0.1.0` · **License:** MIT

## Product goals

1. Use it in a **web page** for basic VNC (connect, display, human keyboard/mouse).
2. Expose APIs for **screenshot + keyboard/mouse** (and optional recognition hooks) so **AI Agents** can automate remote UIs.
3. Mobile scaling / gestures are **out of scope** for now.

## Status (Phases 0–5)

| Phase | Status |
|-------|--------|
| P0 decisions (MIT, `svnc`, Raw→Tight, screenshot-first, non-viewOnly, **D7 peripheral TLS**) | Done |
| P1 Wrap Spike (frozen Automation types; Wrap retired) | Done |
| P2 Lean RFB (WS, none/VNCAuth, encodings, Canvas) | Done |
| P3 frame/damage, drag/scroll/dblclick, inputMode, errors, clipboard docs | Done |
| P4 RecognitionProvider + stubs + Agent examples | Done (no built-in vision — D3) |
| P5 productization (ESM/types, CI, lite page, security docs, `0.1.0`) | Done |

## Install

```bash
npm install svnc
```

Requires a browser (or JSDOM-like) environment with **WebSocket** + **Canvas**, and a VNC path reachable as WebSocket (websockify or native WS VNC).

## Quick API sketch

```ts
import { SVNCClient } from 'svnc';

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

Transport for classic TCP VNC: use **websockify** (SVNC does not ship a bridge product). See [docs/websockify-decision.md](./docs/websockify-decision.md).

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

- [Roadmap](./docs/roadmap.md) (incl. closed decisions D1–D7)
- [Design proposal](./docs/design-proposal.md)
- [Compat matrix](./docs/compat-matrix.md)
- [Peripheral security (WSS / VPN / SSH vs VeNCrypt)](./docs/peripheral-security.md)
- [Security / Automation threat model](./docs/security.md)
- [Lean RFB gaps](./docs/lean-rfb-gaps.md)
- [npm 手动发布](./docs/npm-publish.md)
- [Changelog](./CHANGELOG.md)

## Develop

```bash
npm install
npm test
npm run build
```

### Local demo / e2e

```bash
npm run build
npm run e2e:start
# lite:  http://127.0.0.1:8080/examples/lite/
# demo:  http://127.0.0.1:8080/examples/demo/
# password: svnc-demo
npm run e2e:verify
npm run e2e:stop
```

Details: [docs/e2e-local.md](./docs/e2e-local.md).
