# Agent demo — GitHub org → repo via SVNC API

Drives the remote Chrome on the local e2e VNC desktop using only SVNC Automation APIs
(`click`, `typeText`, `screenshot`, …). OCR on screenshots is **outside** the library (D3).

## Prerequisites

```bash
npm run build
./scripts/local-e2e/start.sh
# Chrome visible on DISPLAY=:99
```

## Run

```bash
node examples/agent-github-nav/run.mjs
```

Artifacts: `.local-e2e/artifacts/github-nav/` (`*.png`, `report.json`).
