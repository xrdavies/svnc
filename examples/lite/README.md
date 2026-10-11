# SVNC Lite

Minimal browser page: URL + password + Connect, then canvas display with human mouse/keyboard.

Comparable in spirit to noVNC’s `vnc_lite.html` — **not** a full control bar.

```bash
# from repo root
npm run build
npm run e2e:start   # or your own websockify
# open http://127.0.0.1:8080/examples/lite/
```

For Automation buttons (click/type/screenshot), use [../demo/](../demo/).
