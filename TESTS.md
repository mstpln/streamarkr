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

## v0.11.0 merged backend-foundation validation
PR #2 merged after exact-head validation:
- PWA build: PASS.
- Worker type-check/build: PASS.
- logic/repository/Worker/client/security tests: **120/120 PASS**.
- Node SQLite D1 migration semantics: **5/5 PASS**.
- Playwright browser/responsive QA: **27/27 PASS**.
- smoke-journey console/page errors: **0**.

The 120-test suite includes Worker auth/CORS/error-safety, canonical-title mutation preconditions, stable crosswalk preservation, D1 repository behavior, browser client behavior, service-worker API-cache safety, and the preserved application/domain regression suite.

## v0.12.0 — Wrangler-local D1 runtime validation
The current build adds a second migration gate using Cloudflare's local D1 runtime rather than relying on generic SQLite semantics alone.

### Deterministic SQLite semantics
```bash
npm run test:d1
```
Expected: **5/5 PASS** using Node 22's built-in SQLite engine.

Coverage:
- migration applies cleanly and is idempotent;
- canonical `(media_type, tmdb_id)` uniqueness and `${media_type}-${tmdb_id}` key format;
- simultaneous subscription + rent availability for one title/service;
- restrictive foreign-key behavior prevents provider title deletion from cascading away Library membership;
- all eight agreed service registry rows exist without silently preselecting personal preferences.

### Wrangler-local D1 runtime
```bash
npm run test:d1:wrangler
```
The validator invokes exactly Wrangler **4.129.0** and uses only `wrangler.local.jsonc` plus ignored `.wrangler/test-d1` state. It must:
1. clear only the isolated local test-state directory;
2. apply committed migrations with `wrangler d1 migrations apply streamarkr-local --local`;
3. query the same local D1 state with `wrangler d1 execute ... --local --json`;
4. assert `schema_version = 1`;
5. assert all **8** seeded services;
6. assert the `titles` table exists;
7. assert Wrangler's `d1_migrations` tracking table exists.

This command must never use `--remote`, a real Cloudflare database identifier, production credentials, personal data, or BANDMARKR resources.

### Browser / responsive QA
```bash
npm run build
npm run serve
npm run qa:browser
```
The exact final v0.12.0 PR head must preserve **27/27** Playwright checks with zero smoke-journey console/page errors at folded 344×792 and unfolded 873×1000.

## v0.12.0 CI gate
`.github/workflows/ci.yml` runs, in order:
1. explicit checkout of the pull request **head SHA** rather than relying only on GitHub's synthetic merge ref;
2. `npm ci --no-audit --no-fund`;
3. PWA build;
4. Worker type-check/build;
5. **120** logic/repository/Worker/client/security tests;
6. **5** deterministic SQLite D1 migration tests;
7. pinned Wrangler 4.129.0 local D1 migration/runtime validation;
8. Playwright Chromium install;
9. PWA browser/responsive QA.

The literal final PR head is authoritative. Merge readiness requires both CI jobs green on that exact head plus no unresolved blocking review findings.

## Manual limitation
A physical **Pixel 9 Pro Fold** has not yet been tested. Browser viewport QA covers representative folded/unfolded dimensions, but physical-device validation remains required before V1 release.
