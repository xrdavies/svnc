# SVNC browser demo

Static page that loads the built lean RFB client from `../../dist/index.js`.

## Prerequisites

1. Build: `npm run build` from repo root
2. Start local topology: `./scripts/local-e2e/start.sh`

## Open

- Demo: http://127.0.0.1:8080/examples/demo/
- Default WS: `ws://127.0.0.1:6080/`
- Default password: `svnc-demo`

Coordinates are **remote desktop pixels** (CSS size is scaled to the framebuffer).

## Human input

After **Connect** (default `inputMode=mixed`, viewOnly off):

1. Click the remote canvas to focus it
2. Mouse move / click / drag / wheel are sent as RFB PointerEvents
3. Keyboard (while canvas focused) is sent as RFB KeyEvents

Use `inputMode=script` to disable DOM forwarding (Automation API only). Hard-refresh the page after `npm run build` so the browser loads the new `dist/` bundle (Ctrl+Shift+R / Cmd+Shift+R).
