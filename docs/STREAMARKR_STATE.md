# Streamarkr current state

Updated: 2026-09-08. Current build: **v0.15.0** / service-worker cache **streamarkr-v0.15.0**.

## Repository baseline
- Public repo: `mstpln/streamarkr`.
- PR #1 merged at `438997dedc282366339e6507d826441d99a81adc` and established the reviewed v0.10.2 synthetic/local baseline.
- PR #2 merged at `65fba889597a22f7703b3337833fc1f0ca3c5cb1` and established the reviewed v0.11.0 Worker + D1 source foundation.
- PR #3 merged at `02238c00150b059e9f73cb768e87a62a0d8b25e9` and established the reviewed v0.12.0 Wrangler-local D1 validation layer.
- PR #4 merged at `bb1b59427eaa906c5ae3e85a7daba9bdf2601770` and established the reviewed v0.13.0 guarded Cloudflare activation configuration.
- PR #6 merged at `73359c56825ea7d9b6bfa1245f513d23c9e08e30` and fixed the Wrangler 4.129.0 remote migration invocation.
- PR #7 merged at `d9dc0cda4cf57f2e9322739241ff65f4d09bbafb` and synchronized verified Cloudflare activation state.
- PR #8 merged at `f6e6d4a04aa011e91036a773655e9572e2c6ded6` and established the reviewed v0.14.0 backend snapshot cache bridge. Exact final head `469235cc3e7ffe0df614b612bc73480cf4fd6da1` passed CI #123.
- PR #9 is the active v0.15.0 durable backend user-state build. It does not enable production browser backend mode and does not authorize a production deployment.

## Cloudflare account state
Dedicated Streamarkr resources are active: D1 `streamarkr` with EU jurisdiction, Worker `streamarkr-api`, Worker binding `DB`, runtime secret `DEVICE_ACCESS_TOKEN`, and guarded Workers Builds using `deploy/production`. The real D1 identifier remains outside the public repository.

With explicit user authorization, deployment branch commit `0c62c574a2680a01ae06dde2c1362e2ec1b5369a` deployed reviewed main commit `73359c56825ea7d9b6bfa1245f513d23c9e08e30`. Manual verification confirmed healthy Worker/D1 connectivity, schema version 1, eight seeded services and the expected tables. No personal viewing data, live-provider credentials/calls, or BANDMARKR resources were used. `APP_ORIGIN` remains intentionally unset. The prior deployment authorization is consumed; every future production deployment requires fresh explicit user authorization.

## Validated PWA behavior preserved
- Installable PWA with Home, Discover, My Library, History, Search, Alerts, Settings, and universal movie/series detail pages.
- The active browser runtime remains deliberately synthetic/fake-provider mode until production PWA origin/auth bootstrap and local-state migration are complete.
- IndexedDB is the browser cache/offline layer; D1 is the target durable source of truth once backend mode is activated.
- User-owned Library membership, 1-5 star ratings, manual watched/unwatched overrides, selected streaming services, historical watched-service, and alert seen state retain their established ownership boundaries.
- Finished requires provider series status `Ended`; untouched newer seasons do not break Caught Up; On Hold uses real provider watch timestamps only.
- Season bulk corrections affect only currently known/released episodes, never future episodes.
- Home, Library, History, Search, Discover, Detail, Alerts and Settings behaviors remain covered by deterministic browser QA.
- Streaming-service marks remain placeholders pending licensed assets; Pixel 9 Pro Fold remains the primary physical-device target.

## v0.11.0 Worker + D1 foundation
- `worker/index.ts` provides authenticated API routing; `worker/repository.ts` is the D1 persistence boundary.
- `migrations/0001_initial.sql` defines normalized durable storage for canonical titles/provider state and user-owned state.
- Canonical title identity is media type + TMDB ID, with Trakt/IMDb/availability IDs as secondary crosswalks.
- D1 availability identity is `(title_id, service_key, option_type)`.
- Personal routes require `DEVICE_ACCESS_TOKEN`; CORS is exact-origin only via `APP_ORIGIN`.
- Shared `BackendSnapshot` / `WorkerBackendClient` seams exist.

## v0.12.0 local Cloudflare validation
- `wrangler.local.jsonc` is local-only with non-production identifiers.
- Wrangler **4.129.0** is pinned.
- Local D1 validation applies committed migrations only to ignored Wrangler state and verifies schema version 1, eight services, `titles`, and migration history.

## v0.13.0 guarded activation
- Cloudflare Worker/D1 activation is complete and verified.
- Committed config remains account-neutral; remote deployment verifies named Streamarkr D1 identity and the required Worker secret before mutation, then applies migrations with automatic provisioning disabled.
- Normal `main` merges do not deploy production; only explicitly authorized advancement of `deploy/production` does.

## v0.14.0 backend cache bridge — merged
- IndexedDB schema v2 aligns availability identity with D1.
- Backend snapshots hydrate the related browser cache atomically.
- Initial backend takeover is blocked for non-empty fixture/local/legacy caches until an explicit migration/reset exists.
- Backend-hydrated caches survive offline fixture seeding; failed Worker refresh leaves prior cache intact.
- Local-only user mutations and synthetic provider sync are blocked while backend-cache mode is active.
- Exact final PR #8 head `469235cc3e7ffe0df614b612bc73480cf4fd6da1` passed CI #123: 137/137 tests, D1 5/5, Wrangler-local PASS, browser QA 27/27 and zero smoke-pass console errors.

## v0.15.0 durable user-state mutation surface — PR #9 active
- `WorkerBackendClient` now exposes watched-service set/clear, movie/episode/season watched-state corrections, service selection and custom-service creation in addition to snapshot/Library/rating/alert operations.
- Watched-service mutations require both a canonical title and a known service.
- Movie overrides require canonical movies; episode/season overrides require canonical series. The HTTP layer rejects obvious media-scope mismatches before D1, and the repository independently enforces the same invariant.
- Episode overrides require an existing episode. Season bulk overrides require an existing season; season number 0 remains valid for specials.
- Season bulk corrections are computed server-side from episodes already known and released at action time, remove any legacy season wildcard, and materialize only episode-level overrides in one D1 batch. Future episodes cannot inherit an old bulk action.
- Streaming-service preference changes require an existing service. Custom services are durable selected `unsupported` rows with punctuation/whitespace normalized to route-safe lowercase hyphenated keys.
- Local IndexedDB custom-service behavior matches the Worker/D1 normalization and 80-character route bounds. Re-adding the same service selects the existing row; a distinct display name that collides on the normalized key is rejected rather than silently merged.
- User/service-controlled display text used in Settings, Detail, History and Library filter options is escaped before HTML insertion. Hostile synthetic rendering regressions verify it remains literal text and does not execute markup.
- Settings bounds custom-service input and reports invalid/colliding names through an inline status instead of producing an unhandled page error.
- Request payloads remain bounded and unexpected backend errors remain sanitized.
- The browser UI is **not yet switched to these Worker mutation methods**. Production browser mode remains disabled until safe authentication, local-state migration/reconciliation, real PWA origin and UI write routing are complete.
- No Worker URL or credential is embedded in frontend source. `APP_ORIGIN` remains unset. No v0.15.0 deployment is authorized.
- The final code/security-review head before continuity-only updates is `207db99c32aab71ef72895e72c07d1ce4fcad0c1`. CI #166 passed: PWA build PASS, Worker type-check PASS, **160/160 tests across 26 suites**, D1 **5/5**, Wrangler-local PASS, browser/responsive QA **31/31**, folded/unfolded PASS and zero smoke-pass console/page errors.

## Still pending
- Complete continuity-only synchronization, then require a full clean CI/browser pass on the unchanged documentation-inclusive PR #9 head and perform final diff/security/review-thread inspection; merge only after explicit user authorization.
- Design safe single-user browser authentication/bootstrap without exposing `DEVICE_ACCESS_TOKEN` in public source/generated assets.
- Migrate/reconcile existing local user-owned state into D1, or deliberately reset it, before first browser backend activation.
- Establish the real PWA hosting origin and configure exact `APP_ORIGIN`.
- Route active UI mutations through `BackendClient` and activate backend mode only after safe authentication/state migration are complete.
- Add real TMDB search/metadata, Trakt OAuth/history, and streaming-availability adapters in focused builds.
- Replace placeholder service badges with properly sourced/licensed logos.
- Run physical Pixel 9 Pro Fold QA before V1 release.
