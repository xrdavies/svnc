# Local e2e topology (Xvfb + x11vnc + websockify + SVNC demo)

> Date: 2026-10-12 (Asia/Shanghai)  
> Server note: **TigerVNC** is the matrix “must-pass” target, but this box had **no sudo** and no TigerVNC packages installed. E2E uses **Xvfb + x11vnc** (compat-matrix “optional对照”) with the same Auth / Encoding / non-viewOnly constraints.

## Ports & credentials

| Service | Bind | Notes |
|---------|------|--------|
| Xvfb | `DISPLAY=:99` | `1280x720x24`, root color `#336699` |
| x11vnc (RFB TCP) | `127.0.0.1:5901` | **VNC Auth**, shared, forever, localhost only |
| websockify | `127.0.0.1:6080` → `127.0.0.1:5901` | WS carries raw RFB bytes |
| Static HTTP | `127.0.0.1:8080` | Serves repo root (demo + `dist/`) |

- **Password:** `svnc-demo` (file `.local-e2e/vnc.pass`, gitignored)
- **Demo URL:** http://127.0.0.1:8080/examples/demo/
- **WS URL:** `ws://127.0.0.1:6080/`

## Start / stop

```bash
npm run build
./scripts/local-e2e/start.sh    # or: npm run e2e:start
./scripts/local-e2e/status.sh
./scripts/local-e2e/stop.sh     # or: npm run e2e:stop
```

Runtime PIDs/logs live under `.local-e2e/` (gitignored).

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

## Results (2026-10-12)

| Check | Result |
|-------|--------|
| Stack start (Xvfb / x11vnc / websockify / HTTP) | ✅ |
| Protocol verify | ✅ **8/8** |
| Browser verify | ✅ **14/14** |
| Screenshot color vs `xsetroot #336699` | ✅ center pixel `(51,102,153)` |
| Click → X11 pointer | ✅ `xdotool` `320,240` |
| Drag → X11 pointer | ✅ `220,180` |
| TigerVNC binary on this box | ❌ not installed (no sudo); documented fallback to x11vnc |
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

## Mapping to roadmap

Satisfies Phase 1 live topology + Phase 2 lean RFB acceptance on a real WS↔TCP path for Auth=VNC Auth, Encoding=Raw (Tight advertised), session **non-viewOnly**.
