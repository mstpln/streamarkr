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
PR #3 added a second migration gate through Cloudflare's local D1 runtime with pinned Wrangler **4.129.0**. The merged exact head passed:
- `npm ci`;
- PWA + Worker builds;
- **120/120** logic/repository/Worker/client/security tests;
- **5/5** deterministic SQLite D1 tests;
- Wrangler-local migration validation;
- **27/27** browser/responsive checks;
- zero console/page errors.

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
The validator invokes repository-pinned Wrangler **4.129.0** and uses only `wrangler.local.jsonc` plus ignored `.wrangler/test-d1` state. It must apply committed migrations with `--local`, verify schema version 1, eight seeded services, the `titles` table and Wrangler's `d1_migrations` table, and explicitly disable automatic resource provisioning.

This command must never use `--remote`, a real Cloudflare database identifier, production credentials, personal data, or BANDMARKR resources.

## v0.13.0 — guarded remote deployment configuration
`npm test` now also runs `tests/cloudflare-deploy-config.test.mjs`.

The deployment-config tests must verify, using only a synthetic UUID:
- missing, malformed and all-zero D1 identifiers are rejected;
- generated Worker name is exactly `streamarkr-api`;
- generated D1 binding is exactly `DB` -> database name `streamarkr`;
- `DEVICE_ACCESS_TOKEN` is declared as a required secret;
- `keep_vars` remains enabled;
- generated config contains no BANDMARKR reference;
- account-specific generated configuration is written only to a caller-supplied temporary directory during tests.

Automated tests must not execute `npm run deploy:cloudflare`, because that command intentionally performs remote D1 migration and Worker deployment when valid Cloudflare build credentials/configuration are present.

## v0.13.0 CI gate
The exact final PR head must pass:
1. explicit checkout of the pull request **head SHA**;
2. `npm ci --no-audit --no-fund`;
3. PWA build;
4. Worker type-check/build;
5. full logic/repository/Worker/client/security/deployment-config suite;
6. **5/5** deterministic SQLite D1 migration tests;
7. pinned Wrangler 4.129.0 local D1 migration/runtime validation;
8. Playwright Chromium install;
9. **27/27** PWA browser/responsive QA with zero console/page errors.

The final review must additionally inspect the public diff for accidental D1 UUIDs, credentials, personal data, temporary workflows, `.wrangler/` generated files, or BANDMARKR references outside explicit safety assertions/documentation.

### Browser / responsive QA
```bash
npm run build
npm run serve
npm run qa:browser
```
The exact final v0.13.0 PR head must preserve **27/27** Playwright checks with zero smoke-journey console/page errors at folded 344×792 and unfolded 873×1000.

## Manual Cloudflare validation after merge — separate authorization
Merging v0.13.0 does not itself authorize a production deployment. After Cloudflare runtime/build secrets and the dedicated deployment branch are configured, an explicitly authorized deployment should verify:
- initial migration applies to dedicated D1 `streamarkr`;
- Worker deployment is `streamarkr-api`;
- `/api/health` returns `ok: true`, `schemaVersion: 1`, and `authConfigured: true`;
- no personal data is introduced during infrastructure validation;
- no BANDMARKR resource is accessed.

## Manual limitation
A physical **Pixel 9 Pro Fold** has not yet been tested. Browser viewport QA covers representative folded/unfolded dimensions, but physical-device validation remains required before V1 release.
