# Streamarkr

Streamarkr is a personal movie and TV tracking PWA for keeping a clean view of what you are watching, what you have watched, what is in your library, and what is available on your streaming services.

## Current status

The repository now contains the validated synthetic/local PWA baseline plus the **v0.11.0 source-level Worker + D1 backend foundation**. The working UI still uses IndexedDB and synthetic providers while the backend migration is staged safely.

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

Validate the D1 migration semantics with Node 22 SQLite:
```bash
npm run test:d1
```

Run browser QA after installing the Playwright Chromium browser once:
```bash
npx playwright install chromium
npm run build
npm run serve
# in another shell/process
npm run qa:browser
```

## Cloudflare activation

`wrangler.example.jsonc` and `.dev.vars.example` are examples only. They contain no usable credentials or real D1 binding. See `docs/CLOUDFLARE_FOUNDATION.md` before any account-level setup.

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
