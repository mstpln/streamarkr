# Streamarkr current state

Updated: 2026-09-07. Current candidate build: **v0.12.0** / service-worker cache **streamarkr-v0.12.0**.

## Repository baseline
- Public repo: `mstpln/streamarkr`.
- PR #1 was merged into `main` at `438997dedc282366339e6507d826441d99a81adc`, establishing the reviewed v0.10.2 synthetic/local baseline.
- PR #2 was merged into `main` at `65fba889597a22f7703b3337833fc1f0ca3c5cb1`, establishing the reviewed v0.11.0 Worker + D1 source foundation.
- Current focused build branch: `feat/wrangler-local-d1-v0120`.
- Nothing has been deployed to Cloudflare and no remote Streamarkr Cloudflare resources have been created or modified.

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

## v0.11.0 Worker + D1 foundation on main
- Separate source-level Cloudflare Worker boundary under `worker/`; it is not deployed or bound to any Cloudflare account resource.
- `migrations/0001_initial.sql` defines normalized D1 tables for titles, metadata, seasons, episodes, watch events, watch overrides, Library, ratings, watched-service, services, availability, alerts, provider connections, sync state, recommendation cache and schema metadata.
- Canonical title identity is media type + TMDB ID, with Trakt/IMDb/availability IDs as secondary crosswalks.
- D1 foreign-key behavior is deliberately non-destructive for durable/user-owned state.
- D1 availability identity is `(title_id, service_key, option_type)`, so subscription/rent/buy rows for one service can coexist.
- `worker/repository.ts` is the D1 persistence boundary; authenticated routes expose a compact snapshot plus initial Library/rating/alert mutations.
- Personal routes fail closed when `DEVICE_ACCESS_TOKEN` is unconfigured; CORS is exact-origin only via `APP_ORIGIN`.
- Worker responses use request IDs and sanitized server errors.
- Shared `BackendSnapshot` / `WorkerBackendClient` seams exist, but the current UI still intentionally uses IndexedDB and fake providers.
- TMDB/Trakt/availability provider interfaces exist without live implementations or credentials.

## v0.12.0 Wrangler-local D1 validation
- Added `wrangler.local.jsonc`, which is local-only and contains a non-production placeholder database ID plus a local preview ID. It is not a real Cloudflare binding.
- The local validator pins the Wrangler CLI invocation to exactly **4.129.0**.
- `npm run test:d1:wrangler` deletes only ignored `.wrangler/test-d1` local state, applies the committed migration with `wrangler d1 migrations apply --local`, and verifies the resulting D1 schema/seed state through `wrangler d1 execute --local --json`.
- The verification requires schema version `1`, all eight seeded streaming services, the `titles` table, and Wrangler's `d1_migrations` history table.
- GitHub CI now gates the migration through both Node 22 SQLite semantics (`npm run test:d1`) and Cloudflare's Wrangler-local D1 runtime (`npm run test:d1:wrangler`).
- This build does not create a remote D1 database, bind a Worker, add a secret, call a provider API, or deploy anything.

## Validation expectations for v0.12.0
- Node 22 and reproducible `npm ci` remain the baseline install path for repository dependencies.
- PWA build and Worker type-check must pass.
- Existing logic/repository/Worker/client/security tests must remain green.
- Node SQLite D1 migration semantics must remain green.
- Wrangler-local D1 migration validation must pass on the literal final PR head.
- Browser/responsive QA must remain **27/27** with zero console/page errors at folded 344×792 and unfolded 873×1000.
- Physical Pixel 9 Pro Fold QA has not yet been performed and remains required before V1 release.

## Still pending
- Create/approve separate Streamarkr Cloudflare Worker and D1 resources only when the user explicitly authorizes that account-level step.
- Activate a real Wrangler config using the separately created Streamarkr D1 identifier only after that authorization; real IDs/secrets remain outside the public repository.
- Move the existing UI/repository calls to the Worker backend in a focused migration while retaining IndexedDB as the cached/offline layer.
- Add real TMDB search/metadata, Trakt OAuth/history, and streaming-availability adapters in later focused builds using secret storage and synthetic provider contract tests.
- Replace placeholder service badges with properly sourced/licensed service logos.
- Run physical Pixel 9 Pro Fold QA before V1 release.
