# SVNC

**Simple VNC** — a browser VNC client with **Agent-friendly screenshot and input APIs**.

Inspired by [noVNC](https://github.com/novnc/noVNC), with a lean self-built RFB path and a frozen Automation contract so programs (not only humans) can operate a remote desktop.

## Product goals

1. Use it in a **web page** for basic VNC (connect, display, human keyboard/mouse).
2. Expose APIs for **screenshot + keyboard/mouse** (and optional recognition hooks) so **AI Agents** can automate remote UIs.
3. Mobile scaling / gestures are **out of scope** for now.

## Status (Phases 0–4)

| Phase | Status |
|-------|--------|
| P0 decisions (MIT, `svnc`, Raw→Tight, screenshot-first, non-viewOnly) | Done |
| P1 Wrap Spike (`novnc-legacy` adapter + frozen types) | Done (live VNC optional) |
| P2 Lean RFB (WS, none/VNCAuth, Raw, Tight subset, Canvas) | Done (library; live matrix optional) |
| P3 frame/damage, drag/scroll/dblclick, inputMode, errors, clipboard docs | Done |
| P4 RecognitionProvider + waitFor/clickTarget stubs + Agent example | Done (no built-in vision — D3) |
| P5 productization (publish, CI matrix) | Not started |

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

## Docs

- [Roadmap](./docs/roadmap.md)
- [Design proposal](./docs/design-proposal.md)
- [Compat matrix](./docs/compat-matrix.md)
- [Spike notes](./docs/spike-notes.md)
- [Clipboard notes](./docs/clipboard.md)

## Develop

```bash
npm install
npm test
npm run build
```

License: **MIT**.
