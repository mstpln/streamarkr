# Streamarkr — Build Progress

Updated: 2026-09-08.

## Authoritative repository status
- Repository: `mstpln/streamarkr` (public).
- `main` is the implementation source of truth.
- PR #1 established v0.10.2 and merged at `438997dedc282366339e6507d826441d99a81adc`.
- PR #2 established v0.11.0 Worker + D1 and merged at `65fba889597a22f7703b3337833fc1f0ca3c5cb1`.
- PR #3 established v0.12.0 Wrangler-local D1 validation and merged at `02238c00150b059e9f73cb768e87a62a0d8b25e9`.
- PR #4 established v0.13.0 guarded Cloudflare activation configuration and merged at `bb1b59427eaa906c5ae3e85a7daba9bdf2601770`.
- PR #6 fixed remote migration invocation and merged at `73359c56825ea7d9b6bfa1245f513d23c9e08e30`.
- PR #7 synchronized Cloudflare activation state and merged at `d9dc0cda4cf57f2e9322739241ff65f4d09bbafb`.
- PR #8 established v0.14.0 backend snapshot/cache bridge and merged at `f6e6d4a04aa011e91036a773655e9572e2c6ded6`.
- PR #9 established v0.15.0 durable Worker user-state mutations and merged at `d6e8a9627dd1a1cab2e6d520753084b902589b9d`.
- PR #10 established v0.16.0 secure browser auth/bootstrap and merged at `c26bc20b3579cc3736621e722d623ead12786564`.
- PR #11 established v0.17.0 safe backend-activation migration and merged at `1e411d1696d32269327b5ef30de5c5f158f302e0`; exact final PR head `6b81e0f3640465dcd1d2ae58ca9510eaffac1b6d` passed CI #271 with 198/198 tests, D1 5/5, Wrangler-local PASS, browser/responsive 32/32, provider/security 8/8 and zero console/page errors.
- PR #12 is the active v0.18.0 same-origin Worker-hosting build on branch `feat/same-origin-worker-hosting-v0180`. It does not authorize or perform a production deployment.

## Cloudflare account state
Dedicated Streamarkr resources already exist: D1 `streamarkr` in EU, Worker `streamarkr-api`, binding `DB`, runtime secret `DEVICE_ACCESS_TOKEN`, and guarded Workers Builds using only `deploy/production`. The real D1 identifier remains outside the public repository.

The previous authorized production deployment used deployment commit `0c62c574a2680a01ae06dde2c1362e2ec1b5369a` for reviewed main `73359c56825ea7d9b6bfa1245f513d23c9e08e30`. That authorization is consumed. Every later production deployment requires fresh explicit user authorization.

## v0.17.0 safe backend activation migration — merged
v0.17.0 added retry-safe IndexedDB-to-D1 migration, durable-user-state fingerprinting, guarded same-ID reconciliation after uncertain responses, authoritative round-trip verification before browser authority changes, Worker-routed user-owned mutations after takeover, cached-first startup, secure Settings connect/reconnect, backend fixture-reset protection and continued synthetic-sync blocking.

No production browser state was migrated and no v0.17 production deployment was authorized.

## v0.18.0 same-origin Worker hosting — PR #12 active
The goal is to remove the remaining hosting/origin blocker without introducing a separate frontend service or custom domain requirement.

Implemented on the PR branch:
- the existing `streamarkr-api` Worker can serve the PWA static assets and `/api/*` from one origin;
- deployable PWA files are staged under ignored `.wrangler/site` rather than uploading repository source/docs/tests;
- generated Wrangler configuration uses SPA fallback and routes `/api/*` Worker-first;
- `npm run build:cloudflare` builds the PWA, type-checks the Worker and prepares the deployable static-asset bundle;
- deployment fails before remote operations when required PWA assets are missing;
- when `APP_ORIGIN` is unset, browser authentication safely uses the actual Worker serving origin as the exact allowed origin; an explicit `APP_ORIGIN` remains an exact override for a future alternate hosting topology;
- cross-origin browser requests still fail closed;
- app/cache version is v0.18.0;
- regression coverage verifies same-origin session behavior and deployment/static-asset boundaries.

Focused implementation validation passed with `npm ci`, `npm run build:cloudflare`, **200/200 tests across 26 suites**, D1 **5/5**, and Wrangler **4.129.0** local-D1 validation. Normal PR CI #273 is the current exact-head validation cycle; final continuity synchronization must be followed by another complete exact-head CI/browser run before merge readiness.

No production deployment, real browser-state migration, live provider call, personal data, secret, or BANDMARKR resource is involved in PR #12.

## Next work
1. Finish PR #12 exact-head CI/browser QA, review the complete diff/security boundary, synchronize continuity files, and require the final unchanged head to pass again before merge readiness.
2. Merge PR #12 only with explicit user authorization.
3. After merge, a **separate fresh explicit authorization** is required before deploying v0.18.0 to the existing Streamarkr Worker. Production validation must confirm the PWA opens at the Worker address, `/api/*` remains API-routed, session cookies work in the real browser, and no personal state is migrated until that path is verified.
4. Then move directly into the real-provider sequence from the master plan: TMDB metadata/search first, followed by Trakt OAuth/history, then streaming availability/alerts and Discover.
5. Complete licensed service marks, performance/accessibility hardening and physical Pixel 9 Pro Fold QA before V1.

## Remaining V1 limitations
- Production still runs the older reviewed Worker source; v0.18.0 has not been deployed.
- No real personal browser state has been migrated to production D1.
- No live TMDB, Trakt or streaming-availability integration yet.
- Streaming-service marks remain placeholders pending properly sourced/licensed assets.
- Physical Pixel 9 Pro Fold QA remains required before V1 release.
