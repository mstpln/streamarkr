# Streamarkr — Tests

Updated: 2026-09-08.

## Test policy
All automated Streamarkr QA is deterministic and synthetic-only. It must never call live Trakt/TMDB/Streaming Availability APIs, production Streamarkr data, the real Streamarkr Cloudflare Worker/D1, or any BANDMARKR resource. No API keys, OAuth tokens, Cloudflare credentials, real D1 identifiers, or personal viewing data belong in test fixtures.

## Core validation commands
```bash
npm ci --no-audit --no-fund
npm run build:cloudflare
npm test
npm run test:d1
npm run test:d1:wrangler
npm run qa:browser
```

`build:cloudflare` builds the PWA, type-checks the Worker and stages only deployable static assets under ignored `.wrangler/site`.

## D1 validation
`npm run test:d1` exercises deterministic migration semantics using Node 22 SQLite and must remain **5/5 PASS**.

`npm run test:d1:wrangler` uses repository-pinned Wrangler **4.129.0**, `wrangler.local.jsonc` and ignored local state only. It verifies schema version 1, eight default services, the `titles` table and migration history. Automated QA never uses `--remote`.

## Merged validation history
- v0.10.2 / PR #1: 101/101 tests, Playwright 27/27.
- v0.11.0 / PR #2: 120/120 tests, D1 5/5, browser 27/27.
- v0.12.0 / PR #3: 120/120 tests, D1 5/5, Wrangler-local PASS, browser 27/27.
- v0.13.0 / PR #6: 126/126 tests, D1 5/5, Wrangler-local PASS, browser 27/27.
- v0.14.0 / PR #8: 137/137 tests, D1 5/5, Wrangler-local PASS, browser 27/27.
- v0.15.0 / PR #9: 164/164 tests, D1 5/5, Wrangler-local PASS, core browser 31/31, provider/security 8/8, zero errors.
- v0.16.0 / PR #10: 176/176 tests, D1 5/5, Wrangler-local PASS, core browser 31/31, provider/security 8/8, zero errors.
- v0.17.0 / PR #11 exact final head `6b81e0f3640465dcd1d2ae58ca9510eaffac1b6d`: 198/198 tests, D1 5/5, Wrangler-local PASS, browser/responsive 32/32, provider/security 8/8, folded/unfolded PASS, zero console/page errors.
- v0.18.0 / PR #12 exact final head `c24795f93e9887620d3bdfacb438422c6e86c56a`: 200/200 tests, D1 5/5, Wrangler-local PASS, browser/responsive 32/32, provider/security 8/8, folded/unfolded PASS and zero console/page errors.
- PR #13 exact final head `086a013ac7e9da913f1940b26d839a7a753d6d09`: 205/205 tests, D1 5/5, Wrangler-local PASS, browser/responsive 32/32, provider/security 8/8, folded/unfolded PASS and zero console/page errors.

## Live production validation
The same-origin PWA, `/api/*` routing, schema version 1, D1 health and configured authentication are live. PR #13 staged diagnostics subsequently established that the current activation failure is at **bootstrap**, before cookie verification or migration. No personal state has been migrated.

## PR #14 browser bootstrap regression coverage
Deterministic tests verify:
- browser bootstrap sends the one-time device token only in a JSON request body and never in the `Authorization` header;
- the bootstrap request remains `credentials: include` and same-origin protected;
- the Worker compares the supplied body token with the configured secret using the existing constant-time digest comparison;
- copied surrounding whitespace is tolerated;
- missing, malformed and incorrect token bodies fail closed without touching D1;
- successful bootstrap still issues the signed `__Host-streamarkr_session` HttpOnly/Secure cookie without containing the device token;
- unexpected session creation errors become controlled `session_creation_failed` responses;
- legacy bearer authentication remains supported for operational clients;
- logout and later migration remain cookie-backed and never re-send the device token;
- arbitrary backend/exception text remains excluded from user-facing diagnostics.

Implementation head `c029d7891add50df815c54036214b078ece1403b` passed CI #309 with:
- Cloudflare bundle PASS, 35 compiled modules;
- **207/207 tests across 26 suites**, zero failures/skips/todos;
- D1 **5/5**;
- Wrangler **4.129.0** local-D1 PASS;
- browser/responsive **32/32**;
- provider/security **8/8**;
- folded 344×792 and unfolded 873×1000 PASS;
- zero console/page errors.

The continuity update recording this validation creates a later head, so the full verify + browser QA workflow must pass again on the final unchanged head before PR #14 is merge-ready.

## Browser QA expectations
The normal PR workflow validates folded/unfolded layouts, no horizontal overflow, Home/Discover/Library/History/Search/Alerts/Settings/Detail journeys, password-only token entry, hostile-markup/deep-link protections and zero unexpected console/page errors.

## Production validation policy
Automated QA never touches production. A production deployment after PR #14 merges requires a fresh explicit authorization. Before real personal-state migration is accepted, the live browser must verify the secure session and complete guarded migration/round-trip verification cleanly.

## Manual limitation
A physical **Pixel 9 Pro Fold** has not yet been tested. Browser viewport QA covers representative folded/unfolded dimensions, but physical-device validation remains required before V1 release.
