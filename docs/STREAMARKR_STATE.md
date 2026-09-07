# Streamarkr current state

Updated: 2026-09-07. Current merged build: **v0.13.0** / service-worker cache **streamarkr-v0.13.0**.

## Repository baseline
- Public repo: `mstpln/streamarkr`.
- PR #1 merged at `438997dedc282366339e6507d826441d99a81adc` and established the reviewed v0.10.2 synthetic/local baseline.
- PR #2 merged at `65fba889597a22f7703b3337833fc1f0ca3c5cb1` and established the reviewed v0.11.0 Worker + D1 source foundation.
- PR #3 merged at `02238c00150b059e9f73cb768e87a62a0d8b25e9` and established the reviewed v0.12.0 Wrangler-local D1 validation layer.
- PR #4 merged at `bb1b59427eaa906c5ae3e85a7daba9bdf2601770` and established the reviewed v0.13.0 guarded Cloudflare activation configuration.
- PR #6 merged at `73359c56825ea7d9b6bfa1245f513d23c9e08e30` and fixed the Wrangler 4.129.0 remote migration invocation discovered by the first safe production attempt.
- Final reviewed PR #6 head: `6020bb2c595d14328d3220226e997b3bbaf1471c`; CI run #83 passed on that exact head.

## Cloudflare account state
The user explicitly created and activated dedicated Streamarkr Cloudflare resources on 2026-09-07:
- D1 database `streamarkr`, with EU jurisdiction;
- Worker `streamarkr-api`;
- Worker D1 binding `DB` -> `streamarkr`;
- runtime secret `DEVICE_ACCESS_TOKEN` stored only in Cloudflare;
- Workers Builds connected to `mstpln/streamarkr` with production branch `deploy/production`, non-production builds disabled, `NODE_VERSION=22`, and masked build secret `STREAMARKR_D1_DATABASE_ID`;
- Workers Builds token extended with D1 Edit so the guarded deployment can apply migrations.

With explicit user authorization, deployment branch commit `0c62c574a2680a01ae06dde2c1362e2ec1b5369a` deployed the reviewed `main` tree from merge commit `73359c56825ea7d9b6bfa1245f513d23c9e08e30`. The Cloudflare build completed successfully.

Manual production verification then confirmed:
- `/api/health` returned `ok: true`, `service: streamarkr-worker`, `schemaVersion: 1`, and `authConfigured: true`;
- remote D1 `app_meta` contains `schema_version = 1`;
- `services` contains exactly eight seeded service rows;
- the expected schema tables are present, including `titles`, `title_metadata`, `seasons`, `episodes`, `watch_events`, `watch_overrides`, `library_items`, `ratings`, `services`, `watched_service`, `availability`, `alerts`, `provider_connections`, `sync_state`, `recommendation_cache`, `app_meta`, plus Wrangler's `d1_migrations` table.

No personal Streamarkr viewing data, live provider credentials/calls, or BANDMARKR resources were used during activation. `APP_ORIGIN` is still intentionally unset until the real PWA hosting origin is established.

## Validated PWA behavior preserved
- Installable synthetic/local PWA with Home, Discover, My Library, History, Search, Alerts, Settings, and universal movie/series detail pages.
- Current UI persistence remains IndexedDB and current provider behavior remains synthetic/fake-only while the frontend-to-Worker migration is staged safely.
- User-owned Library membership, 1-5 star ratings, manual watched/unwatched overrides, selected streaming services, historical watched-service, and alert seen state.
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
- Shared `BackendSnapshot` / `WorkerBackendClient` seams exist, but the UI still intentionally uses IndexedDB and fake providers.

## v0.12.0 local Cloudflare validation
- `wrangler.local.jsonc` remains local-only with non-production identifiers.
- Wrangler **4.129.0** is pinned in the repository.
- `npm run test:d1:wrangler` applies migrations only to ignored local Wrangler state and verifies schema version 1, eight seeded services, the `titles` table, and Wrangler migration history.
- Automated validation remains synthetic-only and does not contact the real Cloudflare account.

## v0.13.0 guarded activation configuration
- App/cache version is v0.13.0 / `streamarkr-v0.13.0`.
- Committed `wrangler.jsonc` contains the Worker name, entry point, compatibility date, `keep_vars: true`, and the required secret name `DEVICE_ACCESS_TOKEN`; it contains no real D1 UUID or secret value.
- `scripts/prepare-cloudflare-deploy.mjs` requires the build-only `STREAMARKR_D1_DATABASE_ID`, validates it as a non-placeholder UUID, and writes an account-specific generated config only under ignored `.wrangler/deploy/` state.
- Generated remote configuration binds exactly `DB` -> database name `streamarkr`, preserves dashboard-managed runtime variables, and requires the Worker secret before deploy.
- `scripts/deploy-cloudflare.mjs` independently resolves the literal remote D1 name `streamarkr` through Cloudflare and requires Cloudflare's authoritative UUID to match `STREAMARKR_D1_DATABASE_ID` before any mutation.
- The deploy path then verifies `DEVICE_ACCESS_TOKEN`, applies pending D1 migrations specifically to `streamarkr` with `--remote`, and deploys the Worker, with Wrangler automatic provisioning and draft-resource auto-creation explicitly disabled.
- Deployment-config tests use only a synthetic UUID and assert the exact Streamarkr Worker/database/binding names and absence of BANDMARKR references.
- Normal `main` merges do not deploy production. Cloudflare Workers Builds watches the dedicated `deploy/production` branch, which is advanced only after explicit user authorization.

## v0.13.0 final validation
The exact final reviewed PR #6 head `6020bb2c595d14328d3220226e997b3bbaf1471c` passed CI run #83:
- PWA build PASS;
- Worker TypeScript build/type-check PASS;
- logic/repository/Worker/client/security/deployment-config tests **126/126 PASS**;
- deterministic SQLite D1 semantics **5/5 PASS**;
- pinned Wrangler 4.129.0 local D1 migration validation PASS;
- Playwright browser/responsive QA **27/27 PASS**;
- folded 344x792 and unfolded 873x1000 PASS;
- zero smoke-journey console/page errors.

The first real Cloudflare activation is also manually verified as described above.

## Still pending
- Set `APP_ORIGIN` once the real PWA hosting origin is known.
- Move the UI/repository calls to the Worker backend in a focused migration while retaining IndexedDB as the cached/offline layer.
- Add real TMDB search/metadata, Trakt OAuth/history, and streaming-availability adapters in later focused builds.
- Replace placeholder service badges with properly sourced/licensed service logos.
- Run physical Pixel 9 Pro Fold QA before V1 release.
