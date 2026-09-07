# Streamarkr current state

Updated: 2026-09-07. Current candidate build: **v0.13.0** / service-worker cache **streamarkr-v0.13.0**.

## Repository baseline
- Public repo: `mstpln/streamarkr`.
- PR #1 merged at `438997dedc282366339e6507d826441d99a81adc` and established the reviewed v0.10.2 synthetic/local baseline.
- PR #2 merged at `65fba889597a22f7703b3337833fc1f0ca3c5cb1` and established the reviewed v0.11.0 Worker + D1 source foundation.
- PR #3 merged at `02238c00150b059e9f73cb768e87a62a0d8b25e9` and established the reviewed v0.12.0 Wrangler-local D1 validation layer.
- Current focused build branch: `feat/cloudflare-activation-config-v0130`.

## Cloudflare account state
The user explicitly created dedicated Streamarkr Cloudflare resources on 2026-09-07:
- D1 database `streamarkr`, with EU jurisdiction;
- Worker `streamarkr-api`;
- Worker D1 binding `DB` -> `streamarkr`.

The active Worker deployment is still Cloudflare's temporary Hello World starter. The real Streamarkr Worker source has **not** been deployed, the D1 migration has **not** been applied remotely, no `DEVICE_ACCESS_TOKEN` has yet been configured for the Streamarkr Worker, and no personal Streamarkr data has been written to D1. Nothing from BANDMARKR has been accessed or reused.

## Validated PWA behavior preserved
- Installable synthetic/local PWA with Home, Discover, My Library, History, Search, Alerts, Settings, and universal movie/series detail pages.
- Current UI persistence remains IndexedDB and current provider behavior remains synthetic/fake-only while the backend migration is staged safely.
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
- App/cache version advances together to v0.13.0 / `streamarkr-v0.13.0`.
- Committed `wrangler.jsonc` contains the Worker name, entry point, compatibility date, `keep_vars: true`, and the required secret name `DEVICE_ACCESS_TOKEN`; it contains no real D1 UUID or secret value.
- `scripts/prepare-cloudflare-deploy.mjs` requires the build-only `STREAMARKR_D1_DATABASE_ID`, validates it as a non-placeholder UUID, and writes an account-specific generated config only under ignored `.wrangler/deploy/` state.
- Generated remote configuration binds exactly `DB` -> database name `streamarkr`, preserves dashboard-managed runtime variables, and requires the Worker secret before deploy.
- `npm run deploy:cloudflare` applies pending D1 migrations remotely and then deploys the Worker, with Wrangler automatic provisioning and draft-resource auto-creation explicitly disabled for both operations.
- Deployment-config tests use only a synthetic UUID and assert the exact Streamarkr Worker/database/binding names and absence of BANDMARKR references.
- Normal `main` merges must not automatically deploy production. Cloudflare Workers Builds is intended to watch a dedicated production deployment branch advanced only after explicit user authorization.

## Still pending
- Complete and review the v0.13.0 PR on its exact final head.
- Configure the Streamarkr Worker runtime secret `DEVICE_ACCESS_TOKEN` in Cloudflare; do not paste its value into GitHub or chat.
- Connect the existing `streamarkr-api` Worker to `mstpln/streamarkr` using a dedicated production deployment branch, with non-production builds disabled and `STREAMARKR_D1_DATABASE_ID` stored only as a masked Cloudflare build secret.
- Explicitly authorize the first real Streamarkr deployment; only then advance the deployment branch so the migration and reviewed Worker deployment occur.
- Set `APP_ORIGIN` once the real PWA hosting origin is known.
- Move the UI/repository calls to the Worker backend in a focused migration while retaining IndexedDB as the cached/offline layer.
- Add real TMDB search/metadata, Trakt OAuth/history, and streaming-availability adapters in later focused builds.
- Replace placeholder service badges with properly sourced/licensed service logos.
- Run physical Pixel 9 Pro Fold QA before V1 release.
