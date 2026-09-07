# Streamarkr

Streamarkr is a personal movie and TV tracking PWA for keeping a clean view of what you are watching, what you have watched, what is in your library, and what is available on your streaming services.

## Current status

The repository contains the validated synthetic/local PWA baseline, the **v0.11.0 source-level Worker + D1 backend foundation**, and the **v0.12.0 Wrangler-local D1 validation layer**. The working UI still uses IndexedDB and synthetic providers while the backend migration is staged safely.

The Worker/D1 source is not deployed and no Cloudflare resource, real provider connection, API key, OAuth token, or personal viewing data is present in this public repository. All automated QA remains synthetic-only.

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

Run deterministic logic/repository/Worker/client tests:
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
This command uses exactly Wrangler `4.129.0`, resets an ignored `.wrangler/test-d1` state directory, applies `migrations/0001_initial.sql` with `--local`, and verifies the resulting schema/seed state. It does not contact or mutate a remote D1 database.

Run browser QA after installing the Playwright Chromium browser once:
```bash
npx playwright install chromium
npm run build
npm run serve
# in another shell/process
npm run qa:browser
```

## Cloudflare activation

`wrangler.local.jsonc` is local-only and contains only a non-production placeholder identifier. `wrangler.example.jsonc` and `.dev.vars.example` remain examples for later account-level activation. None contains usable credentials or a real D1 binding. See `docs/CLOUDFLARE_FOUNDATION.md` before any account-level setup.

Do not create, bind, migrate or deploy Streamarkr against BANDMARKR infrastructure. Streamarkr Worker, D1, secrets and any future R2 storage must remain completely separate.

## Engineering continuity
Read these before making substantial changes:
- `AGENTS.md`
- `docs/STREAMARKR_STATE.md`
- `docs/STREAMARKR_DECISIONS.md`
- `docs/STREAMARKR_BUILD_STATE.json`
- `docs/STREAMARKR_BUILD_PLAN.md`
- `PROGRESS.md`
- `TESTS.md`
