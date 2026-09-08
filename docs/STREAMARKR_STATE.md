# Streamarkr current state

Updated: 2026-09-08. Current build: **v0.16.0** / service-worker cache **streamarkr-v0.16.0**.

## Repository baseline
- Public repo: `mstpln/streamarkr`.
- PR #1 merged at `438997dedc282366339e6507d826441d99a81adc` and established the reviewed v0.10.2 synthetic/local baseline.
- PR #2 merged at `65fba889597a22f7703b3337833fc1f0ca3c5cb1` and established the reviewed v0.11.0 Worker + D1 source foundation.
- PR #3 merged at `02238c00150b059e9f73cb768e87a62a0d8b25e9` and established the reviewed v0.12.0 Wrangler-local D1 validation layer.
- PR #4 merged at `bb1b59427eaa906c5ae3e85a7daba9bdf2601770` and established the reviewed v0.13.0 guarded Cloudflare activation configuration.
- PR #6 merged at `73359c56825ea7d9b6bfa1245f513d23c9e08e30` and fixed the Wrangler 4.129.0 remote migration invocation.
- PR #7 merged at `d9dc0cda4cf57f2e9322739241ff65f4d09bbafb` and synchronized verified Cloudflare activation state.
- PR #8 merged at `f6e6d4a04aa011e91036a773655e9572e2c6ded6` and established the reviewed v0.14.0 backend snapshot cache bridge. Exact final head `469235cc3e7ffe0df614b612bc73480cf4fd6da1` passed CI #123.
- PR #9 merged at `d6e8a9627dd1a1cab2e6d520753084b902589b9d` and established the reviewed v0.15.0 durable backend user-state mutation surface. Exact final head `87dcbf9b3cf77fb8500529d7afbb936c68bf6059` passed CI #215.
- PR #10 is the active v0.16.0 secure browser-auth bootstrap build. It does not set production `APP_ORIGIN`, activate production browser backend mode, migrate personal state, or authorize a production deployment.

## Cloudflare account state
Dedicated Streamarkr resources are active: D1 `streamarkr` with EU jurisdiction, Worker `streamarkr-api`, Worker binding `DB`, runtime secret `DEVICE_ACCESS_TOKEN`, and guarded Workers Builds using `deploy/production`. The real D1 identifier remains outside the public repository.

With explicit user authorization, deployment branch commit `0c62c574a2680a01ae06dde2c1362e2ec1b5369a` deployed reviewed main commit `73359c56825ea7d9b6bfa1245f513d23c9e08e30`. Manual verification confirmed healthy Worker/D1 connectivity, schema version 1, eight seeded services and the expected tables. No personal viewing data, live-provider credentials/calls, or BANDMARKR resources were used. `APP_ORIGIN` remains intentionally unset. The prior deployment authorization is consumed; every future production deployment requires fresh explicit user authorization.

## Validated PWA behavior preserved
- Installable PWA with Home, Discover, My Library, History, Search, Alerts, Settings, and universal movie/series detail pages.
- The active browser runtime remains deliberately synthetic/fake-provider mode until production PWA origin, local-state migration/reconciliation, and backend UI routing are complete.
- IndexedDB is the browser cache/offline layer; D1 is the target durable source of truth once backend mode is activated.
- User-owned Library membership, 1-5 star ratings, manual watched/unwatched overrides, selected streaming services, historical watched-service, and alert seen state retain their established ownership boundaries.
- Finished requires provider series status `Ended`; untouched newer seasons do not break Caught Up; On Hold uses real provider watch timestamps only.
- Season bulk corrections affect only currently known/released episodes, never future episodes.
- User/provider/service-controlled `innerHTML` display text is escaped on all current screens, custom-service brand lookup rejects prototype-like inherited keys, and provider deep links are restricted to HTTP/HTTPS.
- Home, Library, History, Search, Discover, Detail, Alerts and Settings behaviors remain covered by deterministic browser QA.
- Streaming-service marks remain placeholders pending licensed assets; Pixel 9 Pro Fold remains the primary physical-device target.

## v0.14.0 backend cache bridge — merged
- IndexedDB schema v2 aligns availability identity with D1.
- Backend snapshots hydrate the related browser cache atomically.
- Initial backend takeover is blocked for non-empty fixture/local/legacy caches until an explicit migration/reset exists.
- Backend-hydrated caches survive offline fixture seeding; failed Worker refresh leaves prior cache intact.
- Local-only user mutations and synthetic provider sync are blocked while backend-cache mode is active.
- Exact final PR #8 head `469235cc3e7ffe0df614b612bc73480cf4fd6da1` passed CI #123: 137/137 tests, D1 5/5, Wrangler-local PASS, browser QA 27/27 and zero smoke-pass console errors.

## v0.15.0 durable user-state mutation surface — merged
- `WorkerBackendClient` exposes watched-service set/clear, movie/episode/season watched-state corrections, service selection and custom-service creation in addition to snapshot/Library/rating/alert operations.
- Watched-service mutations require a canonical title and a known currently selected service.
- Movie overrides require canonical movies; episode/season overrides require canonical series, and episode/season existence is validated before correction.
- Season bulk corrections are computed server-side from episodes already known and released at action time, remove any legacy season wildcard, and materialize only episode-level overrides in one D1 batch. Season 0 remains valid for specials.
- Local IndexedDB custom-service behavior matches Worker/D1 normalization and 80-character route bounds; same-name additions reselect and different-name normalized-key collisions are rejected.
- Exact final PR #9 head `87dcbf9b3cf77fb8500529d7afbb936c68bf6059` passed CI #215 after continuity synchronization. The implementation-validation head `d683104382bc7337bf0457ab0bb179e64ca3a64c` passed CI #211 with 164/164 tests, D1 5/5, Wrangler-local PASS, core browser/responsive QA 31/31, provider/security browser QA 8/8 and zero console/page errors.

## v0.16.0 secure browser authentication/bootstrap — PR #10 active
- `DEVICE_ACCESS_TOKEN` remains a Worker-side secret and is **not embedded or persisted in public frontend source, generated assets, localStorage, IndexedDB, or cookies**.
- A user-supplied device token can be presented only to `POST /api/auth/session` and exchanged for a signed, expiring browser session.
- Browser sessions are HMAC-SHA256 signed with explicit context, include an expiry and random nonce, and are carried in a `__Host-streamarkr_session` cookie with `HttpOnly`, `Secure`, `Path=/`, and `SameSite=None`.
- Session TTL is 30 days. Tampering or expiry invalidates the session; rotating `DEVICE_ACCESS_TOKEN` invalidates previously signed sessions immediately.
- `GET /api/auth/session` reports the active authentication method. `DELETE /api/auth/session` clears the browser cookie without requiring the device token.
- Credentialed browser CORS is allowed only for exact configured `APP_ORIGIN`. Browser-session requests also require the configured application origin; unexpected/missing origins fail closed for cross-origin Worker use. Operational bearer clients with no browser Origin remain supported for controlled manual verification.
- `WorkerBackendClient` now supports cookie credentials and concrete session bootstrap/status/logout methods. Ordinary browser backend requests can run without a persisted bearer token after bootstrap.
- This is an authentication **foundation only**. No bootstrap UI is wired into the active synthetic runtime, no production `APP_ORIGIN` is configured, and no browser backend activation has occurred.
- If the PWA and Worker remain cross-site at activation time, browser third-party-cookie restrictions must be validated. Prefer a same-site/same-origin deployment path when the real PWA hosting origin is established rather than weakening the HttpOnly-cookie design.
- Review fixed package-manifest/lockfile version drift and added a regression test that keeps those versions synchronized; historical machine-readable validation detail removed by an earlier continuity edit was restored.
- Latest validated implementation/continuity head before final documentation synchronization: `796c2e1c1a058a2a505016f4be2c3ce33ba90b70`, CI #227. PWA build PASS, Worker type-check PASS, **176/176 tests across 26 suites**, D1 **5/5**, Wrangler-local PASS, core browser/responsive QA **31/31**, focused provider/security browser QA **8/8**, folded/unfolded PASS and zero console/page errors.

## Still pending
- Require the full normal CI/browser suite to pass on the final unchanged continuity-synchronized PR #10 head, then perform final diff/security/review-thread inspection; mark ready/merge only after the normal gates and explicit user merge authorization.
- Implement a safe migration/reconciliation path for existing local user-owned IndexedDB state before first browser backend activation.
- Establish the real PWA hosting origin and configure exact production `APP_ORIGIN`; validate cookie behavior for that actual topology.
- Wire the active UI through `WorkerBackendClient` for both reads and writes, and activate backend mode only after authentication and state migration are complete.
- Add real TMDB search/metadata, Trakt OAuth/history, and streaming-availability adapters in focused reviewed builds.
- Replace placeholder service badges with properly sourced/licensed logos.
- Run physical Pixel 9 Pro Fold QA before V1 release.
