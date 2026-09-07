# Streamarkr current state

Updated: 2026-09-07. Current candidate build: **v0.11.0** / service-worker cache **streamarkr-v0.11.0**.

## Repository baseline
- Public repo: `mstpln/streamarkr`.
- PR #1 was merged into `main` at `438997dedc282366339e6507d826441d99a81adc`, establishing the reviewed v0.10.2 baseline.
- Current backend-foundation branch: `feat/worker-d1-foundation-v0110` / PR #2.
- PR #2 must not be merged without explicit user authorization.
- Nothing has been deployed to Cloudflare and no production resources have been created or modified.

## Validated PWA behavior preserved from v0.10.2
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
- Added a separate source-level Cloudflare Worker boundary under `worker/`; it is not deployed or bound to any Cloudflare account resource.
- Added `migrations/0001_initial.sql` with normalized D1 tables for titles, metadata, seasons, episodes, watch events, watch overrides, Library, ratings, watched-service, services, availability, alerts, provider connections, sync state, recommendation cache and schema metadata.
- Canonical title identity remains media type + TMDB ID, with Trakt/IMDb/availability IDs as secondary crosswalks.
- D1 foreign-key behavior is deliberately non-destructive for durable/user-owned state; provider refreshes cannot cascade-delete Library rows.
- D1 availability identity is now `(title_id, service_key, option_type)`, so subscription/rent/buy rows for one service can coexist. This resolves the known IndexedDB prototype limitation at the target-schema level.
- Added a D1 repository boundary for snapshot reads, canonical-title upserts, current availability reconciliation, Library membership, ratings and alert seen-state.
- Added authenticated Worker routes for a compact snapshot plus initial personal-data mutations. The API fails closed if `DEVICE_ACCESS_TOKEN` is not configured.
- Cross-origin access is allowed only for the exact configured `APP_ORIGIN`.
- Every Worker response receives a request ID; unexpected errors are logged structurally without returning raw internal/database messages to the browser.
- Added shared `BackendSnapshot` and `WorkerBackendClient` contracts. The existing UI has not yet been switched to this client, so current synthetic/local behavior remains intact during the migration.
- Added explicit TMDB/Trakt/availability provider interfaces, but no live provider implementation or credential is present.
- `wrangler.example.jsonc` and `.dev.vars.example` are examples only. No active Wrangler binding/configuration containing a real D1 ID or secret is committed.

## Validation for the current PR
- GitHub CI uses Node 22 and reproducible `npm ci` from the committed lockfile.
- PWA build, Worker type-check, existing logic/repository tests, new Worker/client tests, and D1 migration tests are CI-gated.
- Browser/responsive QA remains synthetic-only and must stay green on the exact final PR head.
- Physical Pixel 9 Pro Fold QA has not yet been performed and remains required before V1 release.

## Still pending
- Create/approve separate Streamarkr Cloudflare Worker and D1 resources only when the user authorizes that account-level step.
- Pin/activate the Cloudflare/Wrangler runtime toolchain and validate the migration against Wrangler local D1 before any remote migration.
- Move the existing UI/repository calls to the Worker backend in a focused migration while retaining IndexedDB as the cached/offline layer.
- Add real TMDB search/metadata, Trakt OAuth/history, and streaming-availability adapters in later focused builds using secret storage and synthetic provider contract tests.
- Replace placeholder service badges with properly sourced/licensed service logos.
- Run physical Pixel 9 Pro Fold QA before V1 release.
