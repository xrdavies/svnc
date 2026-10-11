#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RUNTIME="${ROOT}/.local-e2e"

stop_pid() {
  local name="$1" file="$2"
  if [[ -f "${file}" ]]; then
    local pid
    pid="$(cat "${file}" 2>/dev/null || true)"
    if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
      echo "Stopping ${name} (pid ${pid})"
      kill "${pid}" 2>/dev/null || true
      sleep 0.2
      kill -9 "${pid}" 2>/dev/null || true
    fi
    rm -f "${file}"
  else
    echo "${name}: not running"
  fi
}

stop_pid http "${RUNTIME}/http.pid"
stop_pid websockify "${RUNTIME}/websockify.pid"
stop_pid x11vnc "${RUNTIME}/x11vnc.pid"
stop_pid xvfb "${RUNTIME}/xvfb.pid"

DISPLAY_NUM="${SVNC_DISPLAY:-99}"
rm -f "/tmp/.X${DISPLAY_NUM}-lock" 2>/dev/null || true
echo "Stopped."
