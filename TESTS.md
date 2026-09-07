# Streamarkr — Tests

Updated: 2026-09-07.

## Test policy
All automated Streamarkr QA is deterministic and synthetic-only. It must never call live Trakt/TMDB/Streaming Availability APIs, production Streamarkr data, or any BANDMARKR resource. No API keys, OAuth tokens, Cloudflare credentials, or personal viewing data belong in test fixtures.

## v0.10.2 authoritative merged baseline
PR #1 was validated on Node 22 with the committed lockfile and reproducible `npm ci`:
- PWA build: **PASS**.
- Logic/repository tests: **101/101 PASS**.
- Playwright browser/responsive QA: **27/27 PASS**.
- Smoke-journey console/page errors: **0**.
- Folded proxy 344×792: PASS.
- Unfolded proxy 873×1000: PASS.

## v0.11.0 — PR #2 validation
The Worker + D1 foundation adds three validation layers without replacing the existing baseline tests.

### PWA build
```bash
npm run build
```
Result: **PASS**.

### Worker type-check/build
```bash
npm run build:worker
```
Result: **PASS**. This compiles `worker/**/*.ts` plus the shared backend/domain contracts without requiring live Cloudflare resources or credentials.

### Logic / repository / Worker / client tests
```bash
npm test
```
Result: **118/118 PASS**, 0 failures.

This is the merged 101-test baseline plus 17 backend/security tests. New coverage includes:
- bearer device-token authentication accepts only the exact expected value;
- protected routes reject invalid credentials before touching D1;
- protected routes fail closed when the Worker authentication secret is unconfigured;
- exact-origin CORS behavior;
- request IDs on Worker responses;
- unexpected backend failures do not expose raw database/internal error messages;
- rating input validation;
- Library writes require a canonical title record;
- provider title upserts stay in provider-owned storage and do not mutate user-owned tables;
- availability replacement uses one D1 batch and preserves multiple option types per title/service;
- `WorkerBackendClient` sends bearer auth, URL-encodes IDs, sends JSON mutations and does not expose its token in surfaced errors;
- the service worker bypasses Cache Storage for `/api/`, cross-origin, and authenticated requests so future personal API snapshots cannot enter the app-shell cache.

### D1 migration semantics
```bash
npm run test:d1
```
Result: **5/5 PASS** using Node 22's built-in SQLite engine against `migrations/0001_initial.sql`.

Coverage:
- migration applies cleanly and is idempotent;
- canonical `(media_type, tmdb_id)` uniqueness and `${media_type}-${tmdb_id}` key format;
- simultaneous subscription + rent availability for one title/service;
- restrictive foreign-key behavior prevents provider title deletion from cascading away Library membership;
- all eight agreed service registry rows exist without silently preselecting personal preferences.

This SQLite check is a deterministic schema safety layer, not a substitute for Wrangler's local D1 runtime. Before any Cloudflare D1 resource is migrated, the same migration must also pass a pinned Wrangler-local D1 check.

### Browser / responsive QA
```bash
npm run build
npm run serve
npm run qa:browser
```
Result: **27/27 PASS** in GitHub Actions Playwright Chromium on the reviewed v0.11.0 code head; the final documentation head must receive the same gate before merge readiness is declared.

The unchanged synthetic browser journey verifies Home, Library, History, Search, Discover, Settings, Alerts and Detail behavior; Alerts NEW lifecycle; Discover heart behavior; Settings re-entry; semantic ratings; detail progress/trailer/episodes/history/streaming; folded 344×792 and unfolded 873×1000 layouts; and zero smoke-journey console/page errors.

## CI gate
`.github/workflows/ci.yml` runs, in order:
1. `npm ci --no-audit --no-fund`
2. PWA build
3. Worker type-check/build
4. 118 logic/repository/Worker/client/security tests
5. 5 D1 migration tests
6. Playwright Chromium install
7. PWA browser/responsive QA

The exact final PR head remains authoritative. PR #2 is not ready until both CI jobs are green on that head.

## Manual limitation
A physical **Pixel 9 Pro Fold** has not yet been tested. Browser viewport QA covers representative folded/unfolded dimensions, but physical-device validation remains required before V1 release.
