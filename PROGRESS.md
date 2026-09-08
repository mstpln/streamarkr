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
- PR #9 established the v0.15.0 durable backend user-state mutation surface and merged at `d6e8a9627dd1a1cab2e6d520753084b902589b9d`; exact final head `87dcbf9b3cf77fb8500529d7afbb936c68bf6059` passed CI #215.
- PR #10 is the active v0.16.0 secure browser authentication/bootstrap build. It does not activate production browser backend mode and does not authorize deployment.

## Cloudflare account-level setup and activation completed
Dedicated Streamarkr resources are active: D1 `streamarkr` in EU, Worker `streamarkr-api`, binding `DB`, runtime secret `DEVICE_ACCESS_TOKEN`, and guarded Workers Builds using only `deploy/production`. The real D1 identifier remains only in masked Cloudflare configuration.

The first authorized deployment used deployment commit `0c62c574a2680a01ae06dde2c1362e2ec1b5369a` for reviewed main commit `73359c56825ea7d9b6bfa1245f513d23c9e08e30`. Manual verification confirmed healthy Worker/D1 connectivity, schema version 1, eight seeded services and the expected tables. That authorization is consumed; every future production deployment requires fresh explicit authorization.

## Reviewed baseline through v0.15.0
The existing PWA behavior remains the product safety net while infrastructure is migrated. v0.14.0 established guarded atomic Worker-snapshot hydration into IndexedDB while preserving local-state takeover protections. v0.15.0 added the remaining durable user-state Worker/client mutation surface, including watched-service, movie/episode/season corrections, service selection and custom services.

PR #9 review also hardened media-scope/reference checks, season-zero/bounded bulk behavior, custom-service normalization/collision rules, prototype-like service keys, hostile provider/service markup, and unsafe provider deep links. Exact final PR #9 head `87dcbf9b3cf77fb8500529d7afbb936c68bf6059` passed CI #215 before merge.

## v0.16.0 secure browser authentication/bootstrap — PR #10 active
PR #10 adds the authentication foundation required before browser backend activation:
- a user-entered `DEVICE_ACCESS_TOKEN` can be exchanged once through `POST /api/auth/session` for a signed browser session;
- the device token is never embedded or persisted in frontend source, generated assets, localStorage, IndexedDB, or cookies;
- the signed session uses an HttpOnly/Secure `__Host-` cookie with a 30-day TTL, random nonce, and HMAC-SHA256 integrity;
- cookie tampering/expiry fail closed and rotating `DEVICE_ACCESS_TOKEN` invalidates existing sessions;
- `GET /api/auth/session` provides session status and `DELETE /api/auth/session` clears the cookie without requiring the device token;
- exact `APP_ORIGIN` gates credentialed CORS and browser-session access;
- operational bearer-token clients remain supported for controlled manual verification;
- `WorkerBackendClient` now includes credentialed cookie transport plus concrete bootstrap/status/logout methods without forcing auth concerns into the cache-layer `BackendClient` interface.

This remains a foundation build only. `APP_ORIGIN` is still intentionally unset in production, the active UI remains synthetic/local, no personal state has been migrated, and no production deployment has been authorized.

Implementation review found one CI interface regression after the initial auth methods were added to the shared `BackendClient`: existing cache-layer mocks were incorrectly forced to implement auth lifecycle methods. The interface was narrowed back to backend data operations while the concrete `WorkerBackendClient` retains session methods. Later review also found and fixed package-manifest/lockfile version drift, added a regression test for version synchronization, and restored historical validation detail that had been unintentionally compressed out of `STREAMARKR_BUILD_STATE.json`.

Latest validated implementation/continuity head before final documentation synchronization: `796c2e1c1a058a2a505016f4be2c3ce33ba90b70`, CI #227. `npm ci` PASS, PWA build PASS, Worker type-check PASS, **176/176 tests across 26 suites**, D1 **5/5**, Wrangler-local validation PASS, core browser/responsive QA **31/31**, focused provider/security QA **8/8**, folded/unfolded PASS and zero console/page errors.

## Next work
1. Require a clean complete CI/browser pass on the final unchanged continuity-synchronized PR #10 head, then perform final PR/review-thread/security/secrets inspection and only then mark it ready to merge.
2. After v0.16.0 is merged, implement safe local IndexedDB user-state migration/reconciliation into D1 before first browser backend activation.
3. Establish the real PWA hosting origin and configure exact `APP_ORIGIN`; prefer same-origin/same-site API routing and validate actual cookie behavior before activation.
4. Route active UI reads/writes through `WorkerBackendClient` and enable backend mode only after auth and state migration are complete.
5. Add real TMDB metadata/search, Trakt OAuth/history and streaming availability in focused reviewed builds.
6. Replace placeholder service badges with properly sourced/licensed assets and complete physical Pixel 9 Pro Fold QA before V1.

## Remaining V1 limitations
- Production browser backend mode is not enabled; the active UI still uses synthetic providers/local fixture state.
- `APP_ORIGIN` is intentionally unset because the final PWA hosting origin is not established.
- Browser-auth foundation exists in PR #10 but is not wired into the active runtime or production configuration.
- Existing local user-owned state has not yet been migrated/reconciled into D1.
- Worker-backed mutation methods are not yet wired into the active UI/runtime.
- No live provider integration yet.
- Streaming-service marks remain placeholders pending properly sourced/licensed assets.
- Physical Pixel 9 Pro Fold QA remains required before V1 release.
