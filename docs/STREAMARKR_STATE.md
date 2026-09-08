# Streamarkr current state

Updated: 2026-09-08. Current unreleased build: **v0.18.0** / service-worker cache **streamarkr-v0.18.0**.

## Repository baseline
- Public repo: `mstpln/streamarkr`; `main` is authoritative.
- PR #11 / v0.17.0 safe backend activation migration merged at `1e411d1696d32269327b5ef30de5c5f158f302e0`. Exact final PR head `6b81e0f3640465dcd1d2ae58ca9510eaffac1b6d` passed CI #271 with 198/198 tests, D1 5/5, Wrangler-local PASS, browser/responsive 32/32, provider/security 8/8 and zero console/page errors.
- PR #12 is the active v0.18.0 same-origin Worker-hosting build on `feat/same-origin-worker-hosting-v0180`.

## Cloudflare account state
Dedicated Streamarkr resources exist and remain separate from BANDMARKR: D1 `streamarkr` in EU, Worker `streamarkr-api`, Worker binding `DB`, runtime secret `DEVICE_ACCESS_TOKEN`, and guarded Workers Builds using only `deploy/production`. The real D1 identifier stays outside the public repository.

The only previously authorized production deployment used deployment commit `0c62c574a2680a01ae06dde2c1362e2ec1b5369a` for reviewed main `73359c56825ea7d9b6bfa1245f513d23c9e08e30`. That authorization is consumed. No v0.14-v0.18 production deployment is implicitly authorized.

## Validated application behavior
- Installable PWA with Home, Discover, My Library, History, Search, Alerts, Settings and universal movie/series detail pages.
- IndexedDB remains the browser cache/offline read layer. D1 becomes durable authority only after the guarded v0.17 migration is imported, round-trip verified and the browser atomically switches `data_source=backend`.
- User-owned Library membership, 1-5 star ratings, manual watched/unwatched overrides, selected streaming services, historical watched-service and alert seen state retain their established ownership boundaries.
- Finished requires provider series status `Ended`; untouched newer seasons do not break Caught Up; On Hold uses genuine provider watch timestamps, not manual-correction timestamps.
- Season bulk corrections affect only known released episodes and never future episodes.
- User/provider/service-controlled display text is escaped; custom-service lookups reject prototype-like inherited keys; provider deep links are HTTP/HTTPS only.
- Home, Library, History, Search, Discover, Detail, Alerts and Settings remain covered by deterministic browser QA.

## v0.17.0 backend activation migration — merged
- A migration UUID is persisted before the first import request and reused on retry.
- First D1 takeover requires pristine application state apart from the built-in service registry.
- The first import stores the durable user state, its fingerprint and migration marker atomically.
- Same-ID unchanged retries are idempotent. Same-ID changed local state after an uncertain first response may reconcile only while D1 still matches the original durable-user-state fingerprint and provider-owned backend state is untouched; otherwise migration fails closed.
- Provider-owned sync timestamps/cursors are deliberately not promoted from local/synthetic state.
- The browser fetches an authoritative D1 snapshot and verifies durable user-state categories before switching authority.
- Once backend-active, user-owned mutations route through the Worker and then refresh the authoritative snapshot; failed refreshes preserve the last verified offline cache.
- Backend-active startup remains cached-first and fixture reset/synthetic provider sync remain blocked.

## v0.18.0 same-origin Worker hosting — PR #12 active
PR #12 removes the remaining frontend/API-origin blocker using the existing Streamarkr Worker rather than adding another hosting service.

Implemented:
- deployable PWA assets are staged under ignored `.wrangler/site`;
- the generated Worker deployment config serves those assets with SPA fallback;
- `/api/*` is configured Worker-first, while normal app files are served as static assets from the same Worker origin;
- `npm run build:cloudflare` now builds the PWA, type-checks the Worker and prepares the staged asset bundle;
- deployment preflight refuses remote operations if required staged PWA files are absent;
- the browser auth origin defaults to the actual Worker serving origin when `APP_ORIGIN` is unset, so the existing Worker address can host both PWA and API safely;
- an explicit `APP_ORIGIN` remains an exact override if a later topology requires it;
- mismatching browser Origin requests remain rejected;
- only deployable app assets are staged; repository package/docs/tests are excluded;
- app/cache version is v0.18.0.

Focused validation before PR opening passed: `npm ci`, Cloudflare bundle build, **200/200 tests across 26 suites**, D1 **5/5**, and pinned Wrangler **4.129.0** local-D1 validation. Normal PR CI/browser QA is being repeated on the continuity-synchronized exact PR head before merge readiness.

## Production safety boundary
- PR #12 does **not** deploy production.
- Production currently remains on the older reviewed Worker deployment.
- No real personal browser state has been migrated to D1.
- No live TMDB/Trakt/availability credentials or calls are part of this build.
- Any v0.18 production deployment requires a fresh explicit user authorization after merge.
- Real browser-state migration must wait until the deployed same-origin PWA/API path and session cookie behavior are verified in the actual browser.

## Next sequence toward V1
1. Finish review/test/fix cycle for PR #12 and merge only with explicit approval.
2. Separately authorize and validate the v0.18 deployment on the existing `streamarkr-api` Worker when the user chooses to do so.
3. Build real TMDB metadata/search.
4. Build Trakt OAuth/history ingestion and reconciliation.
5. Add real Swedish streaming availability, alert transitions and Discover eligibility/ranking.
6. Finish service branding, performance/accessibility hardening and physical Pixel 9 Pro Fold QA.

## Still pending
- v0.18 is not deployed to production.
- No live provider integration yet.
- Streaming-service marks remain placeholders pending properly sourced/licensed assets.
- Physical Pixel 9 Pro Fold QA remains required before V1 release.
