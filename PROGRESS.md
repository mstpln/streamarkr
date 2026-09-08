# Streamarkr — Build Progress

Updated: 2026-09-08.

## Authoritative repository status
- Repository: `mstpln/streamarkr` (public).
- PR #1 established v0.10.2 and merged at `438997dedc282366339e6507d826441d99a81adc`.
- PR #2 established the v0.11.0 Worker + D1 foundation and merged at `65fba889597a22f7703b3337833fc1f0ca3c5cb1`.
- PR #3 established v0.12.0 Wrangler-local D1 validation and merged at `02238c00150b059e9f73cb768e87a62a0d8b25e9`.
- PR #4 established the v0.13.0 guarded Cloudflare activation configuration and merged at `bb1b59427eaa906c5ae3e85a7daba9bdf2601770`.
- PR #6 fixed the Wrangler 4.129.0 remote migration invocation and merged at `73359c56825ea7d9b6bfa1245f513d23c9e08e30`; exact final head `6020bb2c595d14328d3220226e997b3bbaf1471c` passed CI #83.
- PR #7 synchronized verified Cloudflare activation state and merged at `d9dc0cda4cf57f2e9322739241ff65f4d09bbafb`.
- PR #8 established the v0.14.0 backend snapshot cache bridge and merged at `f6e6d4a04aa011e91036a773655e9572e2c6ded6`; exact final head `469235cc3e7ffe0df614b612bc73480cf4fd6da1` passed CI #123.
- PR #9 is the active v0.15.0 backend user-state build. It does not enable production browser backend mode and does not authorize deployment.

## Cloudflare account-level setup and activation completed
Dedicated Streamarkr resources are active: D1 `streamarkr` in EU, Worker `streamarkr-api`, binding `DB`, runtime secret `DEVICE_ACCESS_TOKEN`, and guarded Workers Builds using only `deploy/production`. The real D1 identifier remains only in masked Cloudflare configuration.

The first authorized deployment used deployment commit `0c62c574a2680a01ae06dde2c1362e2ec1b5369a` for reviewed main commit `73359c56825ea7d9b6bfa1245f513d23c9e08e30`. Manual verification confirmed healthy Worker/D1 connectivity, schema version 1, eight seeded services and the expected tables. That authorization is consumed; every future production deployment requires fresh explicit authorization.

## v0.10.2 reviewed baseline
The baseline remains the product-behavior safety net while infrastructure is migrated. It includes the full synthetic PWA experience and the hardened status, History, Library, Search, Detail, Discover, Alerts, export, offline and responsive behavior documented in `docs/STREAMARKR_STATE.md` and `docs/STREAMARKR_DECISIONS.md`.

Final baseline validation: build PASS, 101/101 logic/repository tests, Playwright 27/27, folded 344×792 PASS, unfolded 873×1000 PASS, zero console/page errors.

## v0.11.0 Worker + D1 foundation
PR #2 added normalized D1 schema, ownership-safe foreign keys, canonical title IDs/crosswalk preservation, multi-option availability identity, Worker auth/CORS/error safety, D1 repository boundaries, initial mutations, provider interfaces, backend-client seams, service-worker API-cache safety and exact-head CI checkout.

## v0.12.0 Wrangler-local D1 validation
PR #3 added repository-pinned Wrangler 4.129.0, local-only Wrangler config, isolated Wrangler local D1 migration validation, CI gating, version/cache synchronization and continuity updates.

## v0.13.0 guarded Cloudflare activation
PR #4 added the guarded deployment architecture and PR #6 corrected the Wrangler migration CLI incompatibility. Committed config remains account-neutral, the deploy path verifies the exact named D1 and required Worker secret before mutation, applies migrations with `--remote`, disables automatic provisioning, and keeps `main` merges separate from production deployment through `deploy/production`.

## v0.14.0 backend snapshot cache bridge
PR #8 is merged. It established IndexedDB as the browser cache/offline layer while D1 remains the target durable authority, aligned availability identity with `(titleId, serviceKey, optionType)`, added guarded atomic `BackendSnapshot` hydration, protected legacy/local caches from silent replacement, blocked local-only writes and synthetic sync while backend-cache mode is active, and preserved the prior cache on failed backend refresh.

Final exact head `469235cc3e7ffe0df614b612bc73480cf4fd6da1`, CI #123: PWA build PASS, Worker type-check PASS, 137/137 tests across 26 suites, D1 semantics 5/5, Wrangler-local validation PASS, browser/responsive QA 27/27, zero smoke-pass console errors.

## v0.15.0 backend user-state routes — PR #9 active
PR #9 adds the remaining core durable Worker/client mutation surface needed before browser backend activation:
- watched-service set/clear;
- movie watched/unwatched corrections;
- episode watched/unwatched corrections, including season-zero specials;
- season bulk corrections materialized only across currently known/released episodes so future episodes never inherit an old bulk decision;
- streaming-service selection;
- custom streaming services with route-safe normalized keys.

Review hardening enforces override media scope in both HTTP routing and the D1 repository, validates episode/season existence before correction, preserves season-zero specials, and keeps season bulk writes bounded and transactional. Local IndexedDB and Worker/D1 custom-service creation use the same route-safe normalization and length bounds; same-name additions reselect an existing service while different-name normalized-key collisions are rejected rather than silently aliasing services.

The security review also closed stored-markup gaps beyond the original service-name surfaces. Provider/user/service-controlled text inserted through `innerHTML` is now escaped across Settings, Detail, Home, Library, History, Search, Discover and Alerts; unsafe provider deep-link schemes are rejected. Custom service logo lookup is hardened against prototype-like keys such as `constructor`. Browser regression QA now exercises these cases directly.

Last validated implementation head before continuity synchronization: `d683104382bc7337bf0457ab0bb179e64ca3a64c`, CI #211. `npm ci` PASS, PWA build PASS, Worker type-check PASS, **164/164 tests across 26 suites**, D1 **5/5**, Wrangler-local validation PASS, core browser/responsive QA **31/31**, focused provider/security QA **8/8**, folded/unfolded PASS and zero console/page errors.

## Next work
1. Require a clean complete CI/browser pass on the final unchanged continuity-synchronized PR #9 head, then perform final PR/review-thread/security inspection; merge only after explicit user authorization.
2. Design the safe single-user browser authentication/bootstrap flow. `DEVICE_ACCESS_TOKEN` must never be embedded in public frontend source/generated assets.
3. Migrate or explicitly reconcile existing local user-owned state into D1 before first backend browser activation.
4. Establish the real PWA hosting origin and configure exact `APP_ORIGIN` only when that hosting decision is made.
5. Route the UI through the Worker-backed mutation methods and enable backend mode only after read/write ownership is complete.
6. Add real TMDB metadata/search, Trakt OAuth/history and streaming availability in focused reviewed builds.
7. Replace placeholder service badges with properly sourced/licensed assets and complete physical Pixel 9 Pro Fold QA before V1.

## Remaining V1 limitations
- Production browser backend mode is not enabled; the active UI still uses synthetic providers/local fixture state.
- `APP_ORIGIN` is intentionally unset because the final PWA hosting origin is not established.
- Browser authentication/bootstrap is not yet designed/activated.
- Existing local user-owned state has not yet been migrated/reconciled into D1.
- The v0.15.0 Worker mutation methods are not yet wired into the active UI/runtime.
- No live provider integration yet.
- Streaming-service marks remain placeholders pending properly sourced/licensed assets.
- Physical Pixel 9 Pro Fold QA remains required before V1 release.
