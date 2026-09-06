# Streamarkr

Streamarkr is a personal movie and TV tracking PWA for keeping a clean view of what you are watching, what you have watched, what is in your library, and what is available on your streaming services.

## Current status

This repository currently contains the reviewed **v0.10.2 synthetic/local baseline**. It is intentionally disconnected from live providers and production infrastructure while the real Trakt, TMDB, streaming-availability, Cloudflare Worker, and D1 integrations are built safely.

All automated QA uses synthetic fixtures only. Real API keys, OAuth secrets, Cloudflare credentials, and personal viewing data must never be committed to this public repository.

## Local development

Requirements:
- Node.js 22+
- npm

Install the exact repository development toolchain:
```bash
npm ci
```

Build and serve:
```bash
npm run build
npm run serve
```
Then open `http://localhost:8787`.

Run deterministic logic/integration tests:
```bash
npm test
```

Run browser QA after installing the Playwright Chromium browser once:
```bash
npx playwright install chromium
npm run build
npm run serve
# in another shell/process
npm run qa:browser
```

## Current automated baseline
- Build: PASS
- Logic/repository tests: **101/101 PASS**
- Playwright browser/responsive QA: **27/27 PASS**
- Physical Pixel 9 Pro Fold QA: pending before V1 release

## Engineering continuity
Read these before making changes:
- `AGENTS.md`
- `docs/STREAMARKR_STATE.md`
- `docs/STREAMARKR_DECISIONS.md`
- `docs/STREAMARKR_BUILD_STATE.json`
- `docs/STREAMARKR_BUILD_PLAN.md`

The current IndexedDB/fake-provider setup is a temporary baseline. The target architecture remains Vite + TypeScript, Cloudflare Worker + D1, and real provider adapters, as defined in the build plan and continuity files.
