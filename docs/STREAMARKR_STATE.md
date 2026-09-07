# Streamarkr current state

Updated: 2026-09-07. Current build: **v0.15.0** / service-worker cache **streamarkr-v0.15.0**.

## Repository baseline
- Public repo: `mstpln/streamarkr`.
- PR #1 merged at `438997dedc282366339e6507d826441d99a81adc` and established the reviewed v0.10.2 synthetic/local baseline.
- PR #2 merged at `65fba889597a22f7703b3337833fc1f0ca3c5cb1` and established the reviewed v0.11.0 Worker + D1 source foundation.
- PR #3 merged at `02238c00150b059e9f73cb768e87a62a0d8b25e9` and established the reviewed v0.12.0 Wrangler-local D1 validation layer.
- PR #4 merged at `bb1b59427eaa906c5ae3e85a7daba9bdf2601770` and established the reviewed v0.13.0 guarded Cloudflare activation configuration.
- PR #6 merged at `73359c56825ea7d9b6bfa1245f513d23c9e08e30` and fixed the Wrangler 4.129.0 remote migration invocation discovered by the first safe production attempt.
- PR #7 merged at `d9dc0cda4cf57f2e9322739241ff65f4d09bbafb` and synchronized continuity documentation after the verified Cloudflare activation.
- PR #8 merged at `f6e6d4a04aa011e91036a773655e9572e2c6ded6` and established the reviewed v0.14.0 backend snapshot cache bridge. Exact final head `469235cc3e7ffe0df614b612bc73480cf4fd6da1` passed CI #123.
- PR #9 is the active v0.15.0 backend user-state build. It does not enable production browser backend mode and does not authorize a production deployment.

## Cloudflare account state
The user explicitly created and activated dedicated Streamarkr Cloudflare resources on 2026-09-07:
- D1 database `streamarkr`, with EU jurisdiction;
- Worker `streamarkr-api`;
- Worker D1 binding `DB` -> `streamarkr`;
- runtime secret `DEVICE_ACCESS_TOKEN` stored only in Cloudflare;
- Workers Builds connected to `mstpln/streamarkr` with production branch `deploy/production`, non-production builds disabled, `NODE_VERSION=22`, and masked build secret `STREAMARKR_D1_DATABASE_ID`;
- Workers Builds token extended with D1 Edit so the guarded deployment can apply migrations.

With explicit user authorization, deployment branch commit `0c62c574a2680a01ae06dde2c1362e2ec1b5369a` deployed the reviewed `main` tree from merge commit `73359c56825ea7d9b6bfa1245f513d23c9e08e30`. Manual verification confirmed healthy Worker/D1 connectivity, schema version 1, eight seeded services and the expected tables.

No personal Streamarkr viewing data, live provider credentials/calls, or BANDMARKR resources were used during activation. `APP_ORIGIN` remains intentionally unset until the real PWA hosting origin is established. The authorization used for that first deployment is consumed; every future production deployment requires fresh explicit user authorization.

## Validated PWA behavior preserved
- Installable PWA with Home, Discover, My Library, History, Search, Alerts, Settings, and universal movie/series detail pages.
- The active browser runtime remains deliberately synthetic/fake-provider mode until production PWA origin/auth bootstrap and local-state migration are complete.
- IndexedDB is the browser cache/offline layer; D1 is the target durable source of truth once backend mode is activated.
- User-owned Library membership, 1-5 star ratings, manual watched/unwatched overrides, selected streaming services, historical watched-service, and alert seen state retain their established ownership boundaries.
- Status engine: To Watch, Watching, On Hold, Caught Up, Finished. Finished requires provider series status `Ended`; untouched newer seasons do not break Caught Up; On Hold uses real provider watch timestamps only.
- Season bulk corrections affect only currently known/released episodes, never future episodes.
- Home: Watching Now/On Hold, Rate Now, and New Season including future seasons known before episode records exist.
- Library and History sorting/filtering preserve the distinction between current availability and historical Where I watched it.
- Search and Library writes protect against dangling title IDs.
- Detail pages include Overview/Episodes/Streaming/History behavior, progress/release context, manual corrections, trailers and primary streaming actions.
- Discover excludes History/Library and requires subscription availability on a selected service.
- Alerts are transition-based, cycle-aware, capped at 30, and preserve the agreed first-visit NEW lifecycle.
- Export preserves stable title/provider crosswalk IDs needed to reconnect user-owned data safely.
- Responsive dark UI remains targeted at Pixel 9 Pro Fold; streaming-service marks remain placeholders pending licensed assets.

## v0.11.0 Worker + D1 foundation
- `worker/index.ts` provides authenticated API routing; `worker/repository.ts` is the D1 persistence boundary.
- `migrations/0001_initial.sql` defines normalized D1 tables for titles, metadata, seasons, episodes, watch events, watch overrides, Library, ratings, watched-service, services, availability, alerts, provider connections, sync state, recommendation cache and schema metadata.
- Canonical title identity is media type + TMDB ID, with Trakt/IMDb/availability IDs as secondary crosswalks.
- D1 availability identity is `(title_id, service_key, option_type)`.
- Personal routes require `DEVICE_ACCESS_TOKEN`; CORS is exact-origin only via `APP_ORIGIN`.
- Shared `BackendSnapshot` / `WorkerBackendClient` seams exist.

## v0.12.0 local Cloudflare validation
- `wrangler.local.jsonc` remains local-only with non-production identifiers.
- Wrangler **4.129.0** is pinned in the repository.
- `npm run test:d1:wrangler` applies migrations only to ignored local Wrangler state and verifies schema version 1, eight seeded services, the `titles` table, and Wrangler migration history.
- Automated validation remains synthetic-only and does not contact the real Cloudflare account.

## v0.13.0 guarded activation
- Cloudflare Worker/D1 activation is complete and verified as described above.
- Committed `wrangler.jsonc` remains account-neutral and contains no real D1 UUID or secret value.
- Remote deployment validates the build-only D1 UUID against Cloudflare's named `streamarkr` database, requires `DEVICE_ACCESS_TOKEN`, applies pending migrations with `--remote`, and disables automatic provisioning/auto-create.
- Normal `main` merges do not deploy production. Workers Builds watches only `deploy/production`, advanced after fresh explicit user authorization.
- Exact final PR #6 head `6020bb2c595d14328d3220226e997b3bbaf1471c` passed CI #83 with 126/126 tests, D1 5/5, Wrangler-local validation and 27/27 browser/responsive QA.

## v0.14.0 backend cache bridge — merged
- IndexedDB schema is version 2 and availability identity is `(titleId, serviceKey, optionType)`.
- The v1 -> v2 migration recreates only provider-owned availability, records invalidation atomically and preserves user-owned stores.
- `db.replaceStores()` validates cache key fields before mutation and replaces related stores in one IndexedDB transaction.
- `repo.applyBackendSnapshot()` validates schema/timestamp and atomically hydrates the complete browser cache from one authenticated snapshot.
- Initial backend takeover is blocked for non-empty fixture/local/legacy caches until explicit migration or reset exists.
- Backend-hydrated caches survive offline fixture seeding and failed Worker refreshes preserve the prior cache.
- Local-only user mutations and synthetic provider sync are blocked while backend-cache mode is active.
- Exact final PR #8 head `469235cc3e7ffe0df614b612bc73480cf4fd6da1` passed CI #123: 137/137 tests, D1 5/5, Wrangler-local PASS, browser QA 27/27 and zero smoke-pass console errors.

## v0.15.0 durable user-state mutation surface — PR #9 active
- `WorkerBackendClient` now has explicit methods for watched-service, movie/episode/season watch corrections, service selection and custom service creation in addition to existing snapshot/Library/rating/alert methods.
- Worker routes persist watched-service selections in D1 and validate both canonical title and service existence.
- Movie and episode correction routes validate watched/unwatched state; wrong movie/series API scope is rejected before D1 access.
- Episode corrections require an existing episode. Season number 0 is supported for specials.
- Season bulk corrections are computed server-side from episodes that are already known and released at action time, remove legacy season wildcards, and materialize only episode-level overrides in one D1 batch. Future episodes therefore never inherit an old bulk action.
- Streaming-service preference changes require an existing service. Custom services are durable selected `unsupported` rows with normalized route-safe keys.
- Request payloads remain bounded and unexpected backend errors remain sanitized.
- The browser UI is **not yet switched to these methods**. The production browser runtime remains synthetic/local until authentication, local-state migration/reconciliation and explicit backend activation are completed.
- No Worker URL or credential is embedded in frontend source. `APP_ORIGIN` remains unset. No v0.15.0 deployment is authorized.
- Initial PR #9 implementation passed CI #125; final exact-head validation is required after review hardening and continuity changes.

## Still pending
- Complete exact-head PR #9 review, tests and browser/responsive QA; merge only after explicit user authorization.
- Design the safe single-user browser authentication/bootstrap path without committing or exposing `DEVICE_ACCESS_TOKEN` in public source/generated assets.
- Migrate/reconcile existing local user-owned state into D1, or deliberately reset it, before first real browser backend activation.
- Decide/establish the real PWA hosting origin and then configure exact `APP_ORIGIN`.
- Route active UI mutations through `BackendClient` and activate backend mode only after safe authentication/state migration are complete.
- Add real TMDB search/metadata, Trakt OAuth/history, and streaming-availability adapters in focused builds.
- Replace placeholder service badges with properly sourced/licensed service logos.
- Run physical Pixel 9 Pro Fold QA before V1 release.
