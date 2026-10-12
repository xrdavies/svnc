# Local e2e topology (Xvfb + x11vnc + websockify + SVNC demo)

> Date: 2026-10-12 (Asia/Shanghai)  
> Server note: **TigerVNC** is the matrix “must-pass” target, but the original agent box had **no sudo** and no TigerVNC packages installed. E2E uses **Xvfb + x11vnc** (compat-matrix “optional对照”) with the same Auth / Encoding / non-viewOnly constraints.

## Platform support

> **No `vnc://`:** SVNC only connects over **`ws://` / `wss://`**. A bare TCP VNC URL (`vnc://…` or `host:5900`) must go through websockify (or native WS VNC) first.

| Path | Platforms | What it starts |
|------|-----------|----------------|
| `npm run e2e:start` | **Linux** (needs `Xvfb`, `x11vnc`, `xsetroot`, `websockify`, `python3`) | Full stack: virtual display + VNC + WS bridge + static HTTP |
| `npm run demo:serve` (alias `e2e:demo`) | **macOS / Windows / Linux** | **Static HTTP only** — Demo/Lite against a VNC WebSocket you already have |

`scripts/local-e2e/start.sh` is **Linux-oriented**. On macOS, `npm run e2e:start` fails early if `x11vnc` (or other deps) are missing and points here. Prefer `demo:serve` + a remote/Docker VNC bridge, or install a local stack (below).

## Ports & credentials (full Linux stack)

| Service | Bind | Notes |
|---------|------|--------|
| Xvfb | `DISPLAY=:99` | `1280x720x24`, root color `#336699` |
| x11vnc (RFB TCP) | `127.0.0.1:5901` | **VNC Auth**, shared, forever, localhost only |
| websockify | `127.0.0.1:6080` → `127.0.0.1:5901` | WS carries raw RFB bytes |
| Static HTTP | `127.0.0.1:8080` | Serves repo root (demo + `dist/`) |

- **Password:** `svnc-demo` (file `.local-e2e/vnc.pass`, gitignored)
- **Demo URL:** http://127.0.0.1:8080/examples/demo/ (full UI) or http://127.0.0.1:8080/examples/lite/ (minimal)
- **WS URL:** `ws://127.0.0.1:6080/`

## Start / stop (Linux full stack)

```bash
npm run build
./scripts/local-e2e/start.sh    # or: npm run e2e:start
./scripts/local-e2e/status.sh
./scripts/local-e2e/stop.sh     # or: npm run e2e:stop
```

Runtime PIDs/logs live under `.local-e2e/` (gitignored).

## macOS / Windows: Demo only + your own VNC WebSocket

SVNC’s browser client only needs a **WebSocket that carries RFB bytes**. You do not need Xvfb on the Mac if something else already exposes that WS.

```bash
npm run build
npm run demo:serve    # or: npm run e2e:demo
```

Then open http://127.0.0.1:8080/examples/demo/ and set the form fields:

| Field | Examples |
|-------|----------|
| **WebSocket URL** | `ws://127.0.0.1:6080/` (local websockify) · `wss://vnc.example.com/` (remote WSS) · Docker-mapped host port |
| **Password** | Your VNC Auth password (or empty if Auth=None) |
| **viewOnly** | Unchecked for click/type (decision **D6**) |

`demo:serve` does **not** start x11vnc or websockify. Point WS at whatever bridge you run.

### Option A — Homebrew pieces on macOS

There is no drop-in Xvfb stack like the Linux script. Typical approach:

1. Run a VNC server that listens on TCP (examples vary by OS version):
   - Screen Sharing / a third-party VNC server; or
   - `brew install tiger-vnc` / related formulas when available for your Mac; or
   - `brew install x11vnc` **only if** you already have an X11 display (XQuartz) — not the same as the Linux `Xvfb` path.
2. Bridge TCP → WebSocket, e.g. after `pipx install websockify` or `brew install websockify`:

   ```bash
   websockify 127.0.0.1:6080 127.0.0.1:5900
   ```

3. `npm run demo:serve` and connect Demo to `ws://127.0.0.1:6080/`.

Exact Homebrew formula names change; if a formula is missing, use Docker (Option B) or a remote host.

### Option B — Docker (recommended on macOS)

Run any image that exposes **websockify (or native WS) + VNC**, map the WS port to the host, then:

```bash
npm run build && npm run demo:serve
# Demo WS URL → ws://127.0.0.1:<mapped-port>/
```

Do not expose the mapped port beyond localhost without auth / allowlists ([security.md](./security.md), [peripheral-security.md](./peripheral-security.md)).

### Option C — Remote VNC already on the network

If you already have `wss://…` or `ws://host:port/`:

```bash
npm run build && npm run demo:serve
```

Paste that URL into the Demo. Prefer **WSS** off-machine ([D7](./peripheral-security.md)).

## Demo page

[`examples/demo/`](../examples/demo/) loads lean `SVNCClient` from `../../dist/index.js` and exercises:

- Connect / disconnect (non-viewOnly by default)
- Screenshot (`screenshot` / `toDataURL`)
- `moveTo` / `click` / `dblclick` / right-click
- `drag` / `scroll`
- `typeText` / `keyPress(Enter)`
- `frame` / damage counters
- Human canvas input (`inputMode` mixed/human): mouse, wheel, keyboard after focus

## Automated verification

Requires the **full Linux stack** (`e2e:start`) plus Chrome / `xdotool` as used by the scripts:

```bash
npm run e2e:verify
# equivalent:
node scripts/local-e2e/verify-protocol.mjs
node scripts/local-e2e/verify-browser.mjs
```

| Suite | What it checks |
|-------|----------------|
| `verify-protocol.mjs` | Node `ws` RFB smoke: version, VNC Auth (project DES), ServerInit, FBU header, Pointer/KeyEvent send |
| `verify-browser.mjs` | Chrome + `puppeteer-core` drives the demo: connect, frames, screenshot + pixel color ≈ `#336699`, click/drag vs `xdotool` on `:99`, typeText/scroll, disconnect |

Artifacts (gitignored): `.local-e2e/artifacts/screenshot.png`, `demo-ui.png`, `browser-verify.json`.

## Results (2026-10-12, Linux agent box)

| Check | Result |
|-------|--------|
| Stack start (Xvfb / x11vnc / websockify / HTTP) | ✅ |
| Protocol verify | ✅ **8/8** |
| Browser verify | ✅ **14/14** |
| Screenshot color vs `xsetroot #336699` | ✅ center pixel `(51,102,153)` |
| Click → X11 pointer | ✅ `xdotool` `320,240` |
| Drag → X11 pointer | ✅ `220,180` |
| TigerVNC binary on that box | ❌ not installed (no sudo); documented fallback to x11vnc |
| Tight palette filter | ✅ implemented during e2e (x11vnc used palette before Raw preference) |
| Client default encoding order | Raw → Tight → CopyRect (broader server compatibility) |

### Unit / build (regression)

- `npm test` — 16 passed  
- `npm run build` — ok  

## Known caveats

1. **Full Raw FBUs** are large (~3.7 MB at 1280×720×32). Disconnect mid-update can log `Broken pipe` in x11vnc; harmless for demo teardown.
2. **favicon.ico** 404 on the static server is cosmetic.
3. Prefer **Raw** first for x11vnc local demos; Tight (incl. palette) is supported but servers vary.
4. Do **not** expose websockify / VNC beyond localhost without auth / allowlists.
5. On macOS, do not expect `e2e:start` to install VNC for you — use `demo:serve` + bridge/Docker/remote.

## Mapping to roadmap

Satisfies Phase 1 live topology + Phase 2 lean RFB acceptance on a real WS↔TCP path for Auth=VNC Auth, Encoding=Raw (Tight advertised), session **non-viewOnly**.
