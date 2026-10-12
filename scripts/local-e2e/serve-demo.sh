#!/usr/bin/env bash
# Serve built SVNC demo/lite pages only (no Xvfb / x11vnc / websockify).
# Use when you already have a WebSocket→VNC endpoint (remote or Docker).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HTTP_PORT="${SVNC_HTTP_PORT:-8080}"

if [[ ! -f "${ROOT}/dist/index.js" ]]; then
  echo "error: dist/index.js missing. Run: npm run build" >&2
  exit 1
fi

echo "Serving repo root at http://127.0.0.1:${HTTP_PORT}/"
echo "  Demo: http://127.0.0.1:${HTTP_PORT}/examples/demo/"
echo "  Lite: http://127.0.0.1:${HTTP_PORT}/examples/lite/"
echo ""
echo "This script does NOT start VNC or websockify."
echo "In the Demo page, set WebSocket URL to your bridge, e.g.:"
echo "  ws://127.0.0.1:6080/     (local websockify)"
echo "  wss://vnc.example.com/  (remote WSS)"
echo "See docs/e2e-local.md (macOS / remote VNC)."
echo ""

cd "${ROOT}"
exec python3 -m http.server "${HTTP_PORT}" --bind 127.0.0.1
