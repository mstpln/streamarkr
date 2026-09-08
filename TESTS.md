# Streamarkr — Tests

Updated: 2026-09-08.

## Test policy
All automated Streamarkr QA is deterministic and synthetic-only. It must never call live Trakt/TMDB/Streaming Availability APIs, production Streamarkr data, the real Streamarkr Cloudflare Worker/D1, or any BANDMARKR resource. No API keys, OAuth tokens, Cloudflare credentials, real D1 identifiers, or personal viewing data belong in test fixtures.

## v0.10.2 authoritative merged baseline
PR #1 was validated on Node 22 with the committed lockfile and reproducible `npm ci`: PWA build PASS, 101/101 logic/repository tests, Playwright 27/27, folded 344×792 PASS, unfolded 873×1000 PASS, zero console/page errors.

## v0.11.0 merged backend-foundation validation
PR #2 merged after exact-head validation: PWA build PASS, Worker type-check PASS, 120/120 tests, Node SQLite D1 semantics 5/5, Playwright 27/27, zero console/page errors.

## v0.12.0 merged Wrangler-local D1 validation
PR #3 added the second migration gate through Cloudflare's local D1 runtime with pinned Wrangler **4.129.0**. The merged exact head passed `npm ci`, PWA + Worker builds, 120/120 tests, 5/5 SQLite D1 tests, Wrangler-local migration validation, 27/27 browser/responsive checks and zero console/page errors.

### Deterministic SQLite semantics
```bash
npm run test:d1
```
Expected: **5/5 PASS** using Node 22's built-in SQLite engine.

Coverage includes migration idempotence, canonical title identity, multi-option availability, restrictive foreign keys and the eight default unselected services.

### Wrangler-local D1 runtime
```bash
npm run test:d1:wrangler
```
The validator uses repository-pinned Wrangler **4.129.0**, `wrangler.local.jsonc` and ignored `.wrangler/test-d1` state only. It applies migrations with `--local`, verifies schema version 1, eight services, the `titles` table and `d1_migrations`, and disables automatic provisioning. It must never use `--remote`, production identifiers/credentials, personal data or BANDMARKR resources.

## v0.13.0 guarded-deployment validation
PR #6 merged at `73359c56825ea7d9b6bfa1245f513d23c9e08e30`; exact reviewed head `6020bb2c595d14328d3220226e997b3bbaf1471c` passed CI #83:
- `npm ci --no-audit --no-fund`: PASS;
- PWA build: PASS;
- Worker build/type-check: PASS;
- 126/126 logic/repository/Worker/client/security/deployment-config tests across 26 suites;
- D1 semantics 5/5;
- Wrangler-local D1 validation PASS;
- Playwright browser/responsive QA 27/27;
- folded/unfolded PASS;
- zero smoke-journey console/page errors.

`npm test` includes `tests/cloudflare-deploy-config.test.mjs`, which uses only synthetic identifiers and verifies the guarded Streamarkr deploy boundary. Automated tests must never execute `npm run deploy:cloudflare`.

## v0.14.0 backend cache bridge — merged
PR #8 merged at `f6e6d4a04aa011e91036a773655e9572e2c6ded6`. Exact final reviewed head `469235cc3e7ffe0df614b612bc73480cf4fd6da1` passed CI #123:
- `npm ci`: PASS;
- PWA build: PASS;
- Worker build/type-check: PASS;
- **137/137 tests across 26 suites**;
- D1 semantics **5/5**;
- Wrangler 4.129.0 local-D1 validation PASS;
- browser/responsive QA **27/27**;
- folded 344×792 and unfolded 873×1000 PASS;
- zero smoke-pass console errors.

v0.14.0 regression coverage includes atomic backend snapshot hydration, multi-option IndexedDB availability, legacy-cache provenance protection, failed-fetch offline preservation, malformed-snapshot rejection before mutation, v1→v2 user-state preservation, backend-cache fixture protection and local-only mutation/synthetic-sync blocking.

## v0.15.0 backend user-state routes — PR #9 active
PR #9 remains synthetic-only and does not activate or contact the production Worker. New deterministic coverage verifies:
- `WorkerBackendClient` request methods, JSON bodies, bearer-header behavior and route encoding for the expanded user-state surface;
- watched-service set/clear requires canonical titles, known services and selected watched services;
- movie and episode watched/unwatched overrides persist through D1 repository methods;
- both HTTP routing and the D1 repository enforce movie/series override scope;
- episode overrides reject unknown episodes and season bulk corrections reject unknown seasons;
- season number 0 remains valid for series specials;
- season bulk corrections query only server-known released episodes at action date and materialize episode-level overrides in one D1 batch;
- future episodes therefore cannot inherit an old season bulk action;
- service-selection mutations require an existing service;
- local IndexedDB and Worker/D1 custom-service creation use the same route-safe punctuation/whitespace normalization and 80-character bounds;
- adding the same normalized service reselects it, while a different-name normalized-key collision is rejected instead of silently aliasing two services;
- prototype-like custom service keys such as `constructor` render with fallback branding and cannot resolve inherited object properties;
- provider/user/service-controlled text inserted through `innerHTML` is escaped across Settings, Detail, Home, Library, History, Search, Discover and Alerts;
- provider title/overview/genre/season/episode/alert hostile markup remains literal text and does not execute;
- unsafe provider deep links such as `javascript:` are not rendered as actionable links;
- Settings bounds custom-service input and reports invalid/conflicting names without an unhandled page error;
- existing auth fail-closed, exact-origin CORS, sanitized backend errors, canonical Library/rating preconditions and alert payload bounds remain covered.

Last validated implementation head before continuity synchronization: `d683104382bc7337bf0457ab0bb179e64ca3a64c`, CI #211:
- `npm ci --no-audit --no-fund`: PASS;
- PWA build: PASS;
- Worker build/type-check: PASS;
- **164/164 tests across 26 suites**;
- deterministic D1 semantics **5/5**;
- pinned Wrangler **4.129.0** local-D1 validation PASS;
- core browser/responsive QA **31/31**;
- focused provider/security browser QA **8/8**;
- folded 344×792 PASS;
- unfolded 873×1000 PASS;
- zero browser console/page errors.

The merge gate remains unchanged: after continuity synchronization, the resulting unchanged PR head must pass the complete normal CI/browser suite before PR #9 is considered merge-ready.

## Manual Cloudflare production validation — completed for v0.13.0
With explicit user authorization, deployment branch commit `0c62c574a2680a01ae06dde2c1362e2ec1b5369a` deployed reviewed main commit `73359c56825ea7d9b6bfa1245f513d23c9e08e30`. Manual verification confirmed successful build/deploy, healthy `/api/health`, D1 schema version 1, eight services and all expected application tables plus `d1_migrations`.

No v0.14.0 or v0.15.0 production deployment has been authorized. A future production deployment requires a fresh explicit user instruction after the relevant reviewed PR is merged.

## Manual limitation
A physical **Pixel 9 Pro Fold** has not yet been tested. Browser viewport QA covers representative folded/unfolded dimensions, but physical-device validation remains required before V1 release.
