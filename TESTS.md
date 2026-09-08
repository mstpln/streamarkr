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

## Baseline validation history
- PR #11 / v0.17.0: 198/198 tests, D1 5/5, Wrangler-local PASS, browser/responsive 32/32, provider/security 8/8.
- PR #12 / v0.18.0: 200/200 tests, D1 5/5, Wrangler-local PASS, browser/responsive 32/32, provider/security 8/8.
- PR #13: 205/205 tests plus the same D1/browser/security gates.
- PR #14: 207/207 tests plus the same D1/browser/security gates before deployment.
- PR #15: 208/208 tests plus the same D1/browser/security gates before merge and deployment.

## Live production status
The same-origin PWA, `/api/*` routing, schema version 1, D1 health and configured authentication are live. After PR #15 deployment, secure activation still fails at initial browser-session bootstrap before cookie verification or migration. No personal state has been migrated.

## PR #16 serving-origin regression coverage
PR #16 changes browser-origin authorization to use the actual Worker request URL origin instead of runtime `APP_ORIGIN` configuration. Deterministic tests verify:
- the current JSON-body browser bootstrap succeeds on the actual serving origin and issues the signed `__Host-streamarkr_session` HttpOnly/Secure cookie;
- a deliberately stale `APP_ORIGIN` value cannot block the genuine serving origin;
- the stale configured origin itself does not become trusted merely because it is configured;
- the cached-client bearer bootstrap still succeeds on the serving origin;
- bad tokens and cross-origin browser requests fail closed;
- cookie-session verification succeeds on the serving origin and rejects a foreign Origin;
- CORS/preflight is emitted only for the actual serving origin;
- authenticated migration succeeds from the serving origin and rejects a foreign Origin before D1 access;
- malformed migration payloads still produce controlled 400 responses;
- no browser-auth test touches production D1.

The first PR #16 CI correctly failed three existing tests that still asserted the old configured-origin contract. Those expectations were updated to the new serving-origin contract. Head `a50066847fc2f566d2c7ccd11327e6c2d0aaccdd` then passed the build, all logic/Worker/client tests, D1 5/5 and Wrangler-local D1. The final continuity-synchronized head must pass the full verify and browser QA workflow before merge readiness.

## Browser QA expectations
The normal PR workflow validates folded/unfolded layouts, no horizontal overflow, Home/Discover/Library/History/Search/Alerts/Settings/Detail journeys, password-only token entry, hostile-markup/deep-link protections and zero unexpected console/page errors.

## Production validation policy
Automated QA never touches production. A production deployment after PR #16 merges requires a fresh explicit authorization. Before real personal-state migration is accepted, the live browser must verify the secure session and complete guarded migration/round-trip verification cleanly.

## Manual limitation
A physical **Pixel 9 Pro Fold** has not yet been tested. Browser viewport QA covers representative folded/unfolded dimensions, but physical-device validation remains required before V1 release.
