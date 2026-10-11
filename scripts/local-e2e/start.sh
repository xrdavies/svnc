#!/usr/bin/env bash
# Start local SVNC e2e topology: Xvfb + x11vnc + websockify + static HTTP.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RUNTIME="${ROOT}/.local-e2e"
mkdir -p "${RUNTIME}"

DISPLAY_NUM="${SVNC_DISPLAY:-99}"
export DISPLAY=":${DISPLAY_NUM}"
VNC_PORT="${SVNC_VNC_PORT:-5901}"
WS_PORT="${SVNC_WS_PORT:-6080}"
HTTP_PORT="${SVNC_HTTP_PORT:-8080}"
GEOMETRY="${SVNC_GEOMETRY:-1280x720x24}"
PASSFILE="${RUNTIME}/vnc.pass"
PASSWORD="${SVNC_VNC_PASSWORD:-svnc-demo}"

if [[ ! -f "${PASSFILE}" ]]; then
  x11vnc -storepasswd "${PASSWORD}" "${PASSFILE}"
fi

stop_pid() {
  local name="$1" file="$2"
  if [[ -f "${file}" ]]; then
    local pid
    pid="$(cat "${file}" 2>/dev/null || true)"
    if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
      echo "Stopping ${name} (pid ${pid})..."
      kill "${pid}" 2>/dev/null || true
      sleep 0.3
      kill -9 "${pid}" 2>/dev/null || true
    fi
    rm -f "${file}"
  fi
}

# Idempotent restart of stack pieces
stop_pid http "${RUNTIME}/http.pid"
stop_pid websockify "${RUNTIME}/websockify.pid"
stop_pid x11vnc "${RUNTIME}/x11vnc.pid"
# Keep Xvfb if already ours; else restart
if [[ -f "${RUNTIME}/xvfb.pid" ]] && kill -0 "$(cat "${RUNTIME}/xvfb.pid")" 2>/dev/null; then
  echo "Xvfb already running on ${DISPLAY}"
else
  rm -f "${RUNTIME}/xvfb.pid"
  if [[ -e "/tmp/.X${DISPLAY_NUM}-lock" ]]; then
    echo "Removing stale lock /tmp/.X${DISPLAY_NUM}-lock"
    rm -f "/tmp/.X${DISPLAY_NUM}-lock" "/tmp/.X11-unix/X${DISPLAY_NUM}" 2>/dev/null || true
  fi
  echo "Starting Xvfb ${DISPLAY} (${GEOMETRY})..."
  Xvfb "${DISPLAY}" -screen 0 "${GEOMETRY}" -ac +extension GLX +render -noreset \
    >"${RUNTIME}/xvfb.log" 2>&1 &
  echo $! >"${RUNTIME}/xvfb.pid"
  sleep 0.5
fi

export DISPLAY
xsetroot -solid '#336699'
# Optional: run xev in background so input can be observed in logs if needed
# (kept off by default to avoid grabbing pointer)

echo "Starting x11vnc on :${VNC_PORT} (VNC Auth, shared, forever)..."
x11vnc \
  -display "${DISPLAY}" \
  -rfbport "${VNC_PORT}" \
  -rfbauth "${PASSFILE}" \
  -forever \
  -shared \
  -localhost \
  -noxdamage \
  -repeat \
  -o "${RUNTIME}/x11vnc.log" \
  >"${RUNTIME}/x11vnc.stdout" 2>&1 &
echo $! >"${RUNTIME}/x11vnc.pid"
sleep 0.8

# Free WS port if a stale websockify holds it
if command -v fuser >/dev/null 2>&1; then
  fuser -k "${WS_PORT}/tcp" 2>/dev/null || true
  sleep 0.3
elif command -v ss >/dev/null 2>&1; then
  stale_pid="$(ss -ltnp "sport = :${WS_PORT}" 2>/dev/null | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1 || true)"
  if [[ -n "${stale_pid}" ]]; then
    echo "Killing stale listener pid ${stale_pid} on :${WS_PORT}"
    kill "${stale_pid}" 2>/dev/null || true
    sleep 0.3
  fi
fi

echo "Starting websockify ws://127.0.0.1:${WS_PORT}/ -> 127.0.0.1:${VNC_PORT}..."
websockify \
  --heartbeat=30 \
  "127.0.0.1:${WS_PORT}" \
  "127.0.0.1:${VNC_PORT}" \
  >"${RUNTIME}/websockify.log" 2>&1 &
echo $! >"${RUNTIME}/websockify.pid"
sleep 0.4

echo "Starting static HTTP on http://127.0.0.1:${HTTP_PORT}/ (repo root)..."
(
  cd "${ROOT}"
  exec python3 -m http.server "${HTTP_PORT}" --bind 127.0.0.1
) >"${RUNTIME}/http.log" 2>&1 &
echo $! >"${RUNTIME}/http.pid"
sleep 0.3

cat >"${RUNTIME}/env.txt" <<ENV
DISPLAY=${DISPLAY}
VNC_PORT=${VNC_PORT}
WS_PORT=${WS_PORT}
HTTP_PORT=${HTTP_PORT}
PASSWORD=${PASSWORD}
WS_URL=ws://127.0.0.1:${WS_PORT}/
DEMO_URL=http://127.0.0.1:${HTTP_PORT}/examples/demo/
SPIKE_URL=http://127.0.0.1:${HTTP_PORT}/examples/spike/
ENV

echo ""
echo "=== SVNC local e2e stack is up ==="
cat "${RUNTIME}/env.txt"
echo ""
echo "Demo:  http://127.0.0.1:${HTTP_PORT}/examples/demo/"
echo "Stop:  ${ROOT}/scripts/local-e2e/stop.sh"
echo "Status:${ROOT}/scripts/local-e2e/status.sh"
