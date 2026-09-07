# Streamarkr

Streamarkr is a personal movie and TV tracking PWA for keeping a clean view of what you are watching, what you have watched, what is in your library, and what is available on your streaming services.

## Current status

The repository contains the validated synthetic/local PWA baseline, the **v0.11.0 source-level Worker + D1 backend foundation**, the **v0.12.0 Wrangler-local D1 validation layer**, and the **v0.13.0 guarded Cloudflare activation configuration**. The working UI still uses IndexedDB and synthetic providers while the backend migration is staged safely.

A dedicated Streamarkr D1 database (`streamarkr`) and Worker (`streamarkr-api`) now exist in the user's Cloudflare account and are bound as `DB`. The currently active Worker deployment is still Cloudflare's temporary Hello World starter; the Streamarkr schema has not yet been migrated remotely and the reviewed Streamarkr Worker source has not yet been deployed. No real provider connection, API key, OAuth token, personal viewing data, D1 UUID, or Cloudflare credential is present in this public repository.

The target architecture remains Vite + TypeScript, a separate Cloudflare Worker, a separate D1 database, optional R2 if justified, and real Trakt/TMDB/streaming-availability adapters as defined in the build plan.

## Local development

Requirements:
- Node.js 22+
- npm

Install the exact repository development toolchain:
```bash
npm ci
```

Build and serve the current PWA:
```bash
npm run build
npm run serve
```
Then open `http://localhost:8787`.

Type-check the Worker foundation:
```bash
npm run build:worker
```

Run deterministic logic/repository/Worker/client/deployment-config tests:
```bash
npm test
```

Validate D1 migration semantics with Node 22 SQLite:
```bash
npm run test:d1
```

Validate the same migration through Cloudflare's local D1 runtime:
```bash
npm run test:d1:wrangler
```
This command uses the repository-pinned Wrangler `4.129.0` installed by `npm ci`, resets an ignored `.wrangler/test-d1` state directory, applies `migrations/0001_initial.sql` with `--local`, and verifies the resulting schema/seed state. It does not contact or mutate a remote D1 database.

Run browser QA after installing the Playwright Chromium browser once:
```bash
npx playwright install chromium
npm run build
npm run serve
# in another shell/process
npm run qa:browser
```

## Cloudflare activation

`wrangler.local.jsonc` remains strictly local-only. The committed `wrangler.jsonc` identifies only the dedicated Worker name and required secret name; it contains no real D1 UUID or secret value.

Remote deployment uses `scripts/prepare-cloudflare-deploy.mjs`. It requires the build-only `STREAMARKR_D1_DATABASE_ID`, validates that it is a non-placeholder UUID, and writes the account-specific D1 binding only into ignored `.wrangler/deploy/` state. `npm run deploy:cloudflare` then applies pending migrations to binding `DB` with `--remote` and deploys the Worker with Wrangler automatic provisioning explicitly disabled. The generated configuration preserves dashboard-managed runtime variables and requires `DEVICE_ACCESS_TOKEN` to already exist on the Worker before deployment.

The intended Cloudflare Workers Builds setup is:
- repository: `mstpln/streamarkr`;
- Worker: `streamarkr-api`;
- production deployment branch: a dedicated deployment branch advanced only after explicit user authorization, not `main`;
- build command: `npm run build:cloudflare`;
- deploy command: `npm run deploy:cloudflare`;
- non-production branch builds disabled;
- build secret `STREAMARKR_D1_DATABASE_ID` set to the dedicated `streamarkr` D1 UUID;
- runtime secret `DEVICE_ACCESS_TOKEN` configured in Worker Variables & Secrets before the first Streamarkr deployment.

This separation prevents an ordinary merge to `main` from silently becoming a production deployment. Do not create, bind, migrate or deploy Streamarkr against BANDMARKR infrastructure. Streamarkr Worker, D1, secrets and any future R2 storage must remain completely separate.

## Engineering continuity
Read these before making substantial changes:
- `AGENTS.md`
- `docs/STREAMARKR_STATE.md`
- `docs/STREAMARKR_DECISIONS.md`
- `docs/STREAMARKR_BUILD_STATE.json`
- `docs/STREAMARKR_BUILD_PLAN.md`
- `PROGRESS.md`
- `TESTS.md`
