# Streamarkr current state

Updated: 2026-09-07. Current build: **v0.14.0** / service-worker cache **streamarkr-v0.14.0**.

## Repository baseline
- Public repo: `mstpln/streamarkr`.
- PR #1 merged at `438997dedc282366339e6507d826441d99a81adc` and established the reviewed v0.10.2 synthetic/local baseline.
- PR #2 merged at `65fba889597a22f7703b3337833fc1f0ca3c5cb1` and established the reviewed v0.11.0 Worker + D1 source foundation.
- PR #3 merged at `02238c00150b059e9f73cb768e87a62a0d8b25e9` and established the reviewed v0.12.0 Wrangler-local D1 validation layer.
- PR #4 merged at `bb1b59427eaa906c5ae3e85a7daba9bdf2601770` and established the reviewed v0.13.0 guarded Cloudflare activation configuration.
- PR #6 merged at `73359c56825ea7d9b6bfa1245f513d23c9e08e30` and fixed the Wrangler 4.129.0 remote migration invocation discovered by the first safe production attempt.
- PR #7 merged at `d9dc0cda4cf57f2e9322739241ff65f4d09bbafb` and synchronized continuity documentation after the verified Cloudflare activation.

## Cloudflare account state
The user explicitly created and activated dedicated Streamarkr Cloudflare resources on 2026-09-07:
- D1 database `streamarkr`, with EU jurisdiction;
- Worker `streamarkr-api`;
- Worker D1 binding `DB` -> `streamarkr`;
- runtime secret `DEVICE_ACCESS_TOKEN` stored only in Cloudflare;
- Workers Builds connected to `mstpln/streamarkr` with production branch `deploy/production`, non-production builds disabled, `NODE_VERSION=22`, and masked build secret `STREAMARKR_D1_DATABASE_ID`;
- Workers Builds token extended with D1 Edit so the guarded deployment can apply migrations.

With explicit user authorization, deployment branch commit `0c62c574a2680a01ae06dde2c1362e2ec1b5369a` deployed the reviewed `main` tree from merge commit `73359c56825ea7d9b6bfa1245f513d23c9e08e30`. The Cloudflare build completed successfully.

Manual production verification confirmed:
- `/api/health` returned `ok: true`, `service: streamarkr-worker`, `schemaVersion: 1`, and `authConfigured: true`;
- remote D1 `app_meta` contains `schema_version = 1`;
- `services` contains exactly eight seeded service rows;
- the expected schema tables are present, including `titles`, `title_metadata`, `seasons`, `episodes`, `watch_events`, `watch_overrides`, `library_items`, `ratings`, `services`, `watched_service`, `availability`, `alerts`, `provider_connections`, `sync_state`, `recommendation_cache`, `app_meta`, plus Wrangler's `d1_migrations` table.

No personal Streamarkr viewing data, live provider credentials/calls, or BANDMARKR resources were used during activation. `APP_ORIGIN` remains intentionally unset until the real PWA hosting origin is established. The authorization used for that first deployment is consumed; every future production deployment requires fresh explicit user authorization.

## Validated PWA behavior preserved
- Installable PWA with Home, Discover, My Library, History, Search, Alerts, Settings, and universal movie/series detail pages.
- The active browser runtime remains deliberately synthetic/fake-provider mode until production PWA origin/auth bootstrap is configured.
- IndexedDB is now explicitly the browser cache/offline layer; D1 is the target durable source of truth once backend mode is activated.
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
- Exact final PR #6 head `6020bb2c595d14328d3220226e997b3bbaf1471c` passed CI #83 with 126/126 logic/repository/Worker/client/security/deployment tests, 5/5 D1 semantics checks, Wrangler-local validation, and 27/27 browser/responsive QA.

## v0.14.0 backend cache bridge
- App/cache version is v0.14.0 / `streamarkr-v0.14.0`.
- IndexedDB schema is version 2. Its availability key is now `(titleId, serviceKey, optionType)`, matching D1 and allowing subscription/rent/buy rows for one title/service to coexist.
- The v1 -> v2 browser migration recreates only the provider-owned `availability` cache, persists an invalidation marker, refills synthetic availability once on the next seed check, and preserves user-owned IndexedDB stores.
- `db.replaceStores()` validates cache key fields before mutation and uses one IndexedDB transaction for complete related-store replacement; scheduling/request failure aborts the transaction rather than committing a partial snapshot.
- `repo.applyBackendSnapshot()` validates backend schema version/timestamp and atomically hydrates titles, metadata, seasons, episodes, watch state, Library, ratings, watched-service, services, availability, alerts and sync state from one authenticated `BackendSnapshot`.
- Initial backend takeover is deliberately blocked when a fixture/local cache already exists. A later activation build must first migrate or explicitly reconcile/reset existing local user-owned state rather than silently replacing it with D1 contents.
- A hydrated backend cache is marked in browser-only metadata and is not overwritten by synthetic fixtures on a later offline startup.
- `refreshBackendCache()` fetches through the existing `BackendClient` seam and only starts local replacement after a successful snapshot fetch; a network failure leaves the prior offline cache intact.
- Local-only user mutations and synthetic provider sync are blocked while a Worker/D1 snapshot cache is active, preventing local edits from being silently lost on the next server snapshot.
- The production browser runtime is **not activated by this build**. No Worker URL/token is embedded, `APP_ORIGIN` remains unset, and the normal UI remains on its current synthetic/local path until a later focused activation build provides local-state migration, secure browser authentication and all required Worker mutation endpoints.
- Settings can distinguish fixture storage from a hydrated Worker/D1 snapshot cache without exposing credentials.

## Still pending
- Migrate/reconcile existing local user-owned state into D1, or deliberately reset it, before first real browser backend activation.
- Decide/establish the real PWA hosting origin and then configure exact `APP_ORIGIN`.
- Design the safe single-user browser authentication/bootstrap path without committing or exposing the device secret in public source.
- Route supported user mutations through `BackendClient` and add the remaining Worker mutation endpoints needed for watched-service, manual overrides and service preferences before enabling backend mode for real use.
- Add real TMDB search/metadata, Trakt OAuth/history, and streaming-availability adapters in focused builds.
- Replace placeholder service badges with properly sourced/licensed service logos.
- Run physical Pixel 9 Pro Fold QA before V1 release.
