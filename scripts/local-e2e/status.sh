#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RUNTIME="${ROOT}/.local-e2e"

check() {
  local name="$1" file="$2"
  if [[ -f "${file}" ]] && kill -0 "$(cat "${file}")" 2>/dev/null; then
    echo "OK  ${name} pid=$(cat "${file}")"
  else
    echo "DOWN ${name}"
  fi
}

check xvfb "${RUNTIME}/xvfb.pid"
check x11vnc "${RUNTIME}/x11vnc.pid"
check websockify "${RUNTIME}/websockify.pid"
check http "${RUNTIME}/http.pid"
[[ -f "${RUNTIME}/env.txt" ]] && { echo "---"; cat "${RUNTIME}/env.txt"; }
