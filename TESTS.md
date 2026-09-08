# Streamarkr — Tests

Updated: 2026-09-08.

## Test policy
All automated Streamarkr QA is deterministic and synthetic-only. It must never call live Trakt/TMDB/Streaming Availability APIs, production Streamarkr data, the real Streamarkr Cloudflare Worker/D1, or any BANDMARKR resource. No API keys, OAuth tokens, Cloudflare credentials, real D1 identifiers, or personal viewing data belong in test fixtures.

## Core validation commands
```bash
npm ci --no-audit --no-fund
npm run build
npm run build:worker
npm test
npm run test:d1
npm run test:d1:wrangler
npm run qa:browser
```

For the v0.18 deployment bundle also run:
```bash
npm run build:cloudflare
```
This builds the PWA, type-checks the Worker and stages only deployable static assets under ignored `.wrangler/site`.

## D1 validation
`npm run test:d1` exercises deterministic migration semantics using Node 22 SQLite and must remain **5/5 PASS**.

`npm run test:d1:wrangler` uses repository-pinned Wrangler **4.129.0**, `wrangler.local.jsonc` and ignored local state only. It verifies schema version 1, eight default services, the `titles` table and migration history. It must never use `--remote` in automated QA.

## Merged validation history
- v0.10.2 / PR #1: 101/101 tests, Playwright 27/27, folded/unfolded PASS, zero console/page errors.
- v0.11.0 / PR #2: 120/120 tests, D1 5/5, browser 27/27.
- v0.12.0 / PR #3: 120/120 tests, D1 5/5, Wrangler-local PASS, browser 27/27.
- v0.13.0 / PR #6 exact reviewed head: 126/126 tests, D1 5/5, Wrangler-local PASS, browser 27/27.
- v0.14.0 / PR #8 exact final head `469235cc3e7ffe0df614b612bc73480cf4fd6da1`: 137/137 tests, D1 5/5, Wrangler-local PASS, browser 27/27.
- v0.15.0 / PR #9 exact final head `87dcbf9b3cf77fb8500529d7afbb936c68bf6059`: 164/164 tests, D1 5/5, Wrangler-local PASS, core browser 31/31, provider/security 8/8, zero errors.
- v0.16.0 / PR #10 exact final head `4191f46ee1b1549d2c5079ec1781e302db395476`: 176/176 tests, D1 5/5, Wrangler-local PASS, core browser 31/31, provider/security 8/8, zero errors.
- v0.17.0 / PR #11 exact final head `6b81e0f3640465dcd1d2ae58ca9510eaffac1b6d`: CI #271 passed 198/198 tests across 26 suites, D1 5/5, Wrangler-local PASS, core browser/responsive 32/32, provider/security 8/8, folded/unfolded PASS and zero console/page errors.

## v0.17 migration regression coverage retained
Coverage includes migration UUID persistence/reuse, failed-import local preservation, authenticated/origin-gated import, malformed payload rejection, pristine-D1 takeover, durable-user-state fingerprinting, unchanged retry idempotence, guarded same-ID reconciliation after an uncertain committed response, fail-closed independent backend changes, provider sync-state exclusion, authoritative post-import verification, atomic browser takeover, Worker-routed user mutations, failed-refresh cache preservation, backend fixture-reset protection and browser-session transport without re-sending the device token.

## v0.18.0 same-origin Worker hosting — PR #12 active
New deterministic coverage verifies:
- `build:cloudflare` produces the complete PWA + Worker + staged static-asset bundle;
- generated deployment configuration uses the staged static-asset directory, SPA fallback and `/api/*` Worker-first routing;
- deployment preflight refuses to proceed when the required PWA bundle is missing;
- staging includes required app files/assets while excluding repository package/docs/source-test material;
- with `APP_ORIGIN` unset, secure browser bootstrap defaults to the actual Worker serving origin;
- the resulting signed cookie authenticates same-origin requests;
- a mismatching browser Origin remains rejected;
- an explicitly configured `APP_ORIGIN` continues to enforce exact-origin behavior;
- package manifest, lockfile, machine-readable build state and service-worker cache stay synchronized at v0.18.0.

Focused implementation validation on the v0.18 branch passed:
- `npm ci --no-audit --no-fund`: PASS, 43 packages;
- `npm run build:cloudflare`: PASS, v0.18.0, 34 compiled modules in the service-worker manifest;
- Worker type-check: PASS;
- **200/200 tests across 26 suites**, 0 failures;
- deterministic D1 semantics **5/5**;
- pinned Wrangler **4.129.0** local-D1 validation PASS (`schema_version=1`, services=8, titles table and migration history present).

Normal PR CI #273 is the first PR-head validation cycle. Because continuity files are being synchronized after implementation, the **final unchanged PR head must pass the complete normal verify + browser QA workflow again** before PR #12 can be called merge-ready.

## Browser QA expectations
The normal PR workflow must continue to validate:
- folded 344×792 and unfolded 873×1000 responsive layouts;
- no horizontal overflow;
- Home, Discover, Library, History, Search, Alerts, Settings and Detail journeys;
- secure Settings token field behavior;
- provider/security hostile-markup/deep-link protections;
- zero unexpected console/page errors.

## Production validation policy
The only completed production validation remains the explicitly authorized v0.13-era Streamarkr Worker/D1 deployment. No v0.14-v0.18 production deployment is implicitly authorized.

A future v0.18 production validation must happen only after PR #12 is reviewed/merged and the user gives fresh explicit deployment authorization. It must verify the PWA at the actual Worker address, static asset routing, `/api/*` routing, secure browser-session cookie behavior and health/D1 connectivity **before** migrating real personal browser state.

## Manual limitation
A physical **Pixel 9 Pro Fold** has not yet been tested. Browser viewport QA covers representative folded/unfolded dimensions, but physical-device validation remains required before V1 release.
