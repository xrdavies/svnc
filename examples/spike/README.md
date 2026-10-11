# Phase 1 Wrap Spike + Phase 2 lean client demo

Browser page that can drive either:

1. **Lean RFB** (`SVNCClient` / `RfbSession`) — default after Phase 2  
2. **novnc-legacy** Wrap adapter — deprecated, kept for contrast

## Local topology

See [topology.md](./topology.md). Summary:

```text
TigerVNC (:5901) --TCP--> websockify (:6080) --WS--> browser SVNC
```

Session must be **non-viewOnly** for click / typeText (D6). Do **not** enable viewport scaling so coordinates stay desktop pixels.

## Run (when VNC stack is available)

```bash
# terminal A — display + VNC (example)
Xvfb :1 -screen 0 1280x720x24 &
DISPLAY=:1 xterm &
# TigerVNC or x0vncserver bound to :5901

# terminal B
websockify 6080 localhost:5901

# terminal C — static server for this folder / built demo
npx --yes serve examples/spike -p 4173
```

Open `http://localhost:4173`, set WS URL to `ws://localhost:6080/`, connect, then use **Screenshot / Click / Type**.

## Without a VNC server

This environment may not run TigerVNC. You can still:

- Import types and library code from `src/`
- Run unit tests (`npm test`) for keysym / errors / DES / transport buffer
- Read [docs/spike-notes.md](../../docs/spike-notes.md)

Integration against a live server is documented, not fake-green in CI.
