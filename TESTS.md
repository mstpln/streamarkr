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
npm run qa:worker-auth
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
- surrounding whitespace is normalized consistently on both the browser-supplied token and configured runtime secret while interior token content remains exact;
- no browser-auth test touches production D1.

## Same-origin Worker topology QA
`npm run qa:worker-auth` is a production-topology regression test using pinned Wrangler local mode plus real Chromium. It builds/stages the same Worker static-asset topology used for production and then launches the actual Worker entrypoint, not the synthetic `server.mjs` path.

The test deliberately supplies:
- a stale `APP_ORIGIN` value;
- a synthetic `DEVICE_ACCESS_TOKEN` with surrounding whitespace;
- a browser running on the actual local Worker serving origin.

It then proves **4/4**:
1. same-origin JSON bootstrap succeeds through the actual Worker-first `/api/*` route;
2. Chromium retains and reuses the Worker-issued signed HttpOnly/Secure session cookie;
3. a wrong token fails closed with controlled 401 `unauthorized`;
4. a foreign Origin fails closed with controlled 403 `origin_not_allowed`.

This closes the previous coverage gap where unit tests validated route logic but browser QA never exercised Worker static hosting, Worker-first API routing, cookie issuance and browser cookie reuse together.

## PR #16 hardening validation
Head `c575fabe4e750896af0025c2f9fb45c25b267aae` passed CI #340 / run `34255403504` with:
- Cloudflare bundle PASS, 35 compiled modules;
- **208/208 tests across 26 suites**, zero failures/skips/todos;
- D1 **5/5**;
- Wrangler **4.129.0** local-D1 PASS;
- same-origin Worker authentication topology **4/4**;
- browser/responsive **32/32**;
- provider/security **8/8**;
- folded 344×792 and unfolded 873×1000 PASS;
- zero console/page errors.

The final continuity-synchronized exact PR head must pass the same complete workflow again before merge readiness.

## Browser QA expectations
The normal PR workflow validates folded/unfolded layouts, no horizontal overflow, Home/Discover/Library/History/Search/Alerts/Settings/Detail journeys, password-only token entry, hostile-markup/deep-link protections and zero unexpected console/page errors. The browser job now also runs the real same-origin Worker authentication topology QA before the synthetic UI pass.

## Production validation policy
Automated QA never touches production. A production deployment after PR #16 merges requires a fresh explicit authorization. Before real personal-state migration is accepted, the live browser must verify the secure session and complete guarded migration/round-trip verification cleanly.

## Manual limitation
A physical **Pixel 9 Pro Fold** has not yet been tested. Browser viewport QA covers representative folded/unfolded dimensions, but physical-device validation remains required before V1 release.
