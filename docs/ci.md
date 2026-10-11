# CI

GitHub Actions workflow for this repo (typecheck / test / build on `main` and PRs).

> The `ami-iy` bot token used for some pushes may lack the OAuth **`workflow`** scope, so `.github/workflows/ci.yml` might need to be added by a maintainer (`xrdavies`) or after granting that scope.

## Workflow file

Create `.github/workflows/ci.yml` with:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm

      - name: Install
        run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Test
        run: npm test

      - name: Build
        run: npm run build
```

Local equivalent: `npm ci && npm run typecheck && npm test && npm run build`.
