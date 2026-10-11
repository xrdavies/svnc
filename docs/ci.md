# CI

GitHub Actions workflow for this repo (typecheck / test / build on `main` and PRs).

Workflow file: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

## Workflow

Runs on pushes and pull requests to `main`:

1. Checkout
2. Setup Node 20 (npm cache)
3. `npm ci`
4. `npm run typecheck`
5. `npm test`
6. `npm run build`

Local equivalent: `npm ci && npm run typecheck && npm test && npm run build`.
