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

## v0.15.0 backend user-state routes — merged
PR #9 merged at `d6e8a9627dd1a1cab2e6d520753084b902589b9d`. Exact final continuity-synchronized head `87dcbf9b3cf77fb8500529d7afbb936c68bf6059` passed CI #215 before merge. The implementation-validation head `d683104382bc7337bf0457ab0bb179e64ca3a64c` passed CI #211 with:
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

v0.15.0 deterministic coverage includes the full durable user-state mutation surface, canonical/media-scope/existence checks, season-zero and bounded season bulk corrections, custom-service normalization/collision behavior, prototype-like service keys, hostile provider/service markup escaping, safe provider links, fail-closed auth, exact-origin CORS and sanitized backend errors.

## v0.16.0 secure browser authentication/bootstrap — PR #10 active
PR #10 remains synthetic-only and does not contact or deploy the production Worker. New deterministic coverage verifies:
- a correct user-entered device token can be exchanged only through `POST /api/auth/session` for a signed browser session;
- the session cookie is `__Host-streamarkr_session`, `HttpOnly`, `Secure`, `Path=/` and `SameSite=None`, and never contains the device token;
- browser-session integrity is HMAC-protected and tampered cookies are rejected;
- sessions expire exactly at the configured 30-day boundary;
- rotating `DEVICE_ACCESS_TOKEN` invalidates previously signed sessions;
- browser bootstrap fails closed when `APP_ORIGIN` is absent, when Origin mismatches, or when the device token is invalid;
- browser-session requests require the configured application origin, while same-origin no-Origin cookie requests remain structurally possible for a future same-origin topology;
- credentialed CORS and preflight are emitted only for exact `APP_ORIGIN`;
- `GET /api/auth/session` reports the active authentication method;
- `DELETE /api/auth/session` clears the browser cookie without requiring or exposing the device token;
- legacy bearer authentication remains available for controlled operational/manual clients;
- cookie-mode `WorkerBackendClient` requests include browser credentials without adding a bearer token;
- `bootstrapSession()` sends the device token only on the exchange request and `clearSession()` relies only on the cookie;
- the shared cache-layer `BackendClient` interface remains focused on data operations so existing cache mocks and architecture boundaries are not forced to implement auth lifecycle behavior.

An initial PR #10 CI pass exposed that auth lifecycle methods had been added too broadly to the shared `BackendClient` interface. That regression was fixed on the same branch by retaining the methods only on concrete `WorkerBackendClient`, after which the full suite passed. Additional expiry and secret-rotation coverage was then added.

Last validated implementation head before continuity synchronization: `8dbdcd3d7199768f890dc67f427bb7bffde964ad`, CI #219:
- `npm ci --no-audit --no-fund`: PASS;
- PWA build: PASS;
- Worker build/type-check: PASS;
- **175/175 tests across 26 suites**;
- deterministic D1 semantics **5/5**;
- pinned Wrangler **4.129.0** local-D1 validation PASS;
- core browser/responsive QA **31/31**;
- focused provider/security browser QA **8/8**;
- folded 344×792 PASS;
- unfolded 873×1000 PASS;
- zero browser console/page errors.

The PR #10 merge gate is the same as prior builds: after continuity synchronization, the resulting unchanged exact PR head must pass the complete normal CI/browser suite and final diff/security/review-thread inspection before it can be considered merge-ready.

## Manual Cloudflare production validation — completed for v0.13.0
With explicit user authorization, deployment branch commit `0c62c574a2680a01ae06dde2c1362e2ec1b5369a` deployed reviewed main commit `73359c56825ea7d9b6bfa1245f513d23c9e08e30`. Manual verification confirmed successful build/deploy, healthy `/api/health`, D1 schema version 1, eight services and all expected application tables plus `d1_migrations`.

No v0.14.0, v0.15.0 or v0.16.0 production deployment has been authorized. A future production deployment requires a fresh explicit user instruction after the relevant reviewed PR is merged.

## Manual limitation
A physical **Pixel 9 Pro Fold** has not yet been tested. Browser viewport QA covers representative folded/unfolded dimensions, but physical-device validation remains required before V1 release.
