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
- v0.18.0 / PR #12 exact final head `c24795f93e9887620d3bdfacb438422c6e86c56a`: CI #280 passed the Cloudflare deployment bundle build, 200/200 tests, D1 5/5, Wrangler-local PASS, browser/responsive 32/32, provider/security 8/8, folded/unfolded PASS and zero console/page errors.

## v0.18 production validation
After explicit user authorization, reviewed main `77d8644e06be5a9e61c0938782616f02cdf8f179` was deployed through guarded `deploy/production`.

Manual live validation confirmed:
- PWA root: PASS;
- `/api/health`: PASS with `ok: true`, `service: streamarkr-worker`, `schemaVersion: 1`, `authConfigured: true`;
- `/api/*` routing: PASS;
- D1 health: PASS.

The first secure-storage activation attempt returned the pre-hotfix generic connection/migration failure; a same-browser GET `/api/auth/session` then returned `unauthorized`. This is recorded as an unresolved production activation finding, not a successful browser-session test. No personal state was migrated.

## PR #13 activation diagnostic coverage
New deterministic coverage verifies:
- failed Worker client requests produce a structured `BackendRequestError` carrying only status and an allowlisted backend error code;
- unknown code-shaped response values are discarded instead of being surfaced;
- token bootstrap rejection and cookie/session verification failure are distinguishable;
- origin rejection, migration conflict and invalid migration payload each map to distinct safe diagnostics;
- arbitrary exception text, including synthetic token-bearing text, is never surfaced in user-facing diagnostics;
- backend requests still use `credentials: include` and bootstrap still sends the device token only on the one exchange request;
- migration still uses the cookie-backed request path and never re-sends the device token.

Settings explicitly verifies the cookie-backed session after bootstrap and before migration/reconnect refresh. The token field remains password-only, not prefilled and cleared after use.

Implementation/security review validation on head `6a427406ac172f4f6e26ccfbc168f03c214a1625` passed CI #305 with:
- Cloudflare bundle build PASS, 35 compiled modules;
- **205/205 tests across 26 suites**, zero failures/skips/todos;
- D1 **5/5**;
- Wrangler **4.129.0** local-D1 validation PASS;
- browser/responsive **32/32**;
- provider/security **8/8**;
- folded 344×792 and unfolded 873×1000 PASS;
- zero console/page errors.

The continuity updates recording that validation create a later head, so the complete normal verify + browser QA workflow must pass once more on the final unchanged PR head before PR #13 is merge-ready.

## Browser QA expectations
The normal PR workflow validates:
- folded 344×792 and unfolded 873×1000 responsive layouts;
- no horizontal overflow;
- Home, Discover, Library, History, Search, Alerts, Settings and Detail journeys;
- secure Settings token field behavior;
- provider/security hostile-markup/deep-link protections;
- zero unexpected console/page errors.

## Production validation policy
Automated QA never touches production. Live validation is manual and only after explicit production-deployment authorization. The already-consumed v0.18 authorization does not authorize deployment of PR #13 or any later head.

Before any real personal-state migration is accepted, the live browser must verify the secure session and complete the guarded migration/round-trip verification cleanly.

## Manual limitation
A physical **Pixel 9 Pro Fold** has not yet been tested. Browser viewport QA covers representative folded/unfolded dimensions, but physical-device validation remains required before V1 release.
