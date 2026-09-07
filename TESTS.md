# Streamarkr — Tests

Updated: 2026-09-07.

## Test policy
All automated Streamarkr QA is deterministic and synthetic-only. It must never call live Trakt/TMDB/Streaming Availability APIs, production Streamarkr data, the real Streamarkr Cloudflare Worker/D1, or any BANDMARKR resource. No API keys, OAuth tokens, Cloudflare credentials, real D1 identifiers, or personal viewing data belong in test fixtures.

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

## v0.12.0 merged Wrangler-local D1 validation
PR #3 added a second migration gate through Cloudflare's local D1 runtime with pinned Wrangler **4.129.0**. The merged exact head passed `npm ci`, PWA + Worker builds, 120/120 logic/repository/Worker/client/security tests, 5/5 deterministic SQLite D1 tests, Wrangler-local migration validation, 27/27 browser/responsive checks and zero console/page errors.

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
The validator invokes repository-pinned Wrangler **4.129.0** and uses only `wrangler.local.jsonc` plus ignored `.wrangler/test-d1` state. It applies committed migrations with `--local`, verifies schema version 1, eight seeded services, the `titles` table and Wrangler's `d1_migrations` table, and explicitly disables automatic resource provisioning.

This command must never use `--remote`, a real Cloudflare database identifier, production credentials, personal data, or BANDMARKR resources.

## v0.13.0 guarded-deployment validation
PR #4 established the guarded activation path. PR #6 fixed the first production-attempt blocker (`--yes` is not accepted by Wrangler 4.129.0 for `d1 migrations apply`) and merged at `73359c56825ea7d9b6bfa1245f513d23c9e08e30`. Its exact final reviewed head was `6020bb2c595d14328d3220226e997b3bbaf1471c`, validated by CI run #83.

Final results on that exact head:
- `npm ci --no-audit --no-fund`: PASS;
- PWA build: PASS;
- Worker type-check/build: PASS;
- logic/repository/Worker/client/security/deployment-config tests: **126/126 PASS** across 26 suites;
- deterministic SQLite D1 migration semantics: **5/5 PASS**;
- pinned Wrangler **4.129.0** local D1 migration/runtime validation: PASS;
- Playwright browser/responsive QA: **27/27 PASS**;
- folded 344×792: PASS;
- unfolded 873×1000: PASS;
- smoke-journey console/page errors: **0**.

`npm test` includes `tests/cloudflare-deploy-config.test.mjs`. Using only synthetic identifiers, it verifies malformed/placeholder D1 identifiers are rejected, exact Streamarkr Worker/database/binding identity, D1 UUID preflight, required `DEVICE_ACCESS_TOKEN`, `keep_vars`, BANDMARKR isolation, temporary generated config, and the corrected remote migration invocation.

Automated tests must not execute `npm run deploy:cloudflare`, because that command intentionally performs remote D1 migration and Worker deployment when valid Cloudflare build credentials/configuration are present.

## v0.14.0 backend cache bridge validation
PR #8 adds deterministic browser-cache migration and Worker-snapshot bridge coverage while remaining fully synthetic. An implementation candidate passed **137/137 tests across 26 suites**, **5/5** deterministic D1 semantics and pinned Wrangler **4.129.0** local-D1 validation. Because continuity-document updates change the PR head, the complete normal CI/browser suite must pass again on the unchanged final head before merge.

New regression coverage includes:
- authenticated `BackendSnapshot` data atomically replaces related IndexedDB cache stores only when first takeover is safe;
- simultaneous subscription + rent availability survives because the v2 key includes `optionType`;
- backend cache metadata records snapshot timestamp/source and survives offline fixture seeding;
- failed Worker fetches leave existing offline cache untouched;
- unsupported backend schemas and malformed key-path rows fail before cache replacement/clearing;
- IndexedDB v1 -> v2 recreates only provider-owned availability, preserves user-owned Library/rating rows, and writes its invalidation/refill marker in the same versionchange transaction;
- legacy v0.13-and-older non-empty caches without a `data_source` provenance marker are detected from actual stored data, tagged as fixture/local state during normal startup, and rejected as unsafe initial backend takeover targets;
- initial backend takeover refuses existing local/fixture state rather than silently replacing it;
- synthetic provider sync cannot mutate a Worker/D1-hydrated cache;
- local-only user mutations are blocked in backend-cache mode so they cannot disappear on a later authoritative snapshot refresh;
- `refreshBackendCache()` uses the existing `BackendClient` seam.

The v0.14.0 browser QA remains synthetic; no test is allowed to set `APP_ORIGIN`, use the production Worker token, fetch the real Worker, or operate on real D1/personal data.

## Manual Cloudflare production validation — completed for v0.13.0
With explicit user authorization, deployment branch commit `0c62c574a2680a01ae06dde2c1362e2ec1b5369a` deployed the reviewed `main` tree from merge commit `73359c56825ea7d9b6bfa1245f513d23c9e08e30`.

Manual verification confirmed successful build/deploy, healthy `/api/health`, D1 schema version 1, eight services and all expected application tables plus `d1_migrations`. This activation used no personal viewing data, live provider credentials/calls, or BANDMARKR resources.

No v0.14.0 production deployment is authorized by PR #8; a future production deploy requires a fresh explicit user instruction after merge/review.

## Manual limitation
A physical **Pixel 9 Pro Fold** has not yet been tested. Browser viewport QA covers representative folded/unfolded dimensions, but physical-device validation remains required before V1 release.
