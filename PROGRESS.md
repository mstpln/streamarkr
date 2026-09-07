# Streamarkr — Build Progress

Updated: 2026-09-07.

## Authoritative repository status
- Repository: `mstpln/streamarkr` (public).
- PR #1 established the reviewed v0.10.2 synthetic/local baseline and was merged into `main` at `438997dedc282366339e6507d826441d99a81adc`.
- Current build: **v0.11.0 Worker + D1 backend foundation** on `feat/worker-d1-foundation-v0110`, PR #2.
- PR #2 is not authorized to merge yet.
- No Cloudflare resource has been created, bound, migrated remotely, or deployed.
- No live provider credentials, API keys, OAuth tokens, personal viewing data, or BANDMARKR resources are used.

## v0.10.2 reviewed baseline
The baseline remains the product-behavior safety net while infrastructure is migrated. It includes the full synthetic PWA experience and the hardened status, History, Library, Search, Detail, Discover, Alerts, export, offline and responsive behavior documented in `docs/STREAMARKR_STATE.md` and `docs/STREAMARKR_DECISIONS.md`.

Final baseline validation before merge:
- Build: PASS.
- Logic/repository tests: **101/101 PASS**.
- Playwright browser/responsive QA: **27/27 PASS**.
- Folded proxy: 344×792 PASS.
- Unfolded proxy: 873×1000 PASS.
- Browser console/page errors in smoke journey: 0.

## v0.11.0 — Worker + D1 backend foundation
Implemented on PR #2:

### D1 schema
- Added `migrations/0001_initial.sql` with normalized tables for canonical titles/crosswalks, metadata, seasons, episodes, provider watch events, authoritative manual overrides, Library membership, ratings, historical watched-service, service preferences, current availability, alerts, provider connection state, sync state, recommendation cache and schema metadata.
- Canonical identity is enforced by media type + TMDB ID.
- Durable/user-owned relationships use restrictive foreign keys so provider-owned cleanup cannot cascade-delete personal state.
- Availability now keys by `(title_id, service_key, option_type)`, fixing the prototype limitation that prevented simultaneous subscription/rent/buy rows for one service.
- Initial service registry contains the eight agreed Preferences choices without preselecting personal preferences. Viaplay/TV4 remain unsupported for automatic availability until an actual provider response proves otherwise.

### Worker boundary
- Added an isolated Worker entrypoint and D1 repository layer under `worker/`.
- Personal API routes require a bearer device token sourced from the Worker secret `DEVICE_ACCESS_TOKEN` and fail closed when it is not configured.
- Cross-origin access is exact-origin only through `APP_ORIGIN`.
- Every response carries an `x-request-id`.
- Unexpected backend errors are returned as sanitized generic failures; logs include only request ID, route/method and error class, not raw database/provider messages, credentials or tokens.
- Added initial routes for compact snapshot reads, Library add/remove, rating set/clear and alert seen-state.
- Added provider interfaces for TMDB, Trakt and availability, but no live provider implementation.

### Frontend seam
- Added a shared `BackendSnapshot` contract and `WorkerBackendClient`.
- The current PWA still uses IndexedDB + synthetic adapters so this infrastructure build does not destabilize the working baseline.
- A later focused build will move current repository calls through the Worker and retain IndexedDB as the cached/offline layer.

### Cloudflare activation status
- `wrangler.example.jsonc` and `.dev.vars.example` are deliberately non-production examples only.
- No real D1 database ID or secret is committed.
- Wrangler/Cloudflare runtime dependencies are not yet pinned; that happens before local Wrangler D1 validation and before any account-level Cloudflare setup is authorized.
- Planned isolated names are documented in `docs/CLOUDFLARE_FOUNDATION.md`; Streamarkr must never bind to BANDMARKR resources.

## Validation added for v0.11.0
CI now gates:
- `npm ci`
- PWA build
- Worker TypeScript build/type-check
- the existing domain/repository suite plus Worker/auth/client/repository tests
- deterministic D1 migration semantics against Node 22 SQLite
- existing Playwright browser/responsive QA against synthetic fixtures only

The candidate suite contains **117 TypeScript logic/repository/Worker/client tests**, plus **5 D1 schema tests**, with **27 browser QA checks**. The exact final PR head must pass all of them before PR #2 can be called ready to merge; `TESTS.md` records the final outcome once that exact-head run completes.

## Next work after PR #2 is merged
1. With explicit user approval, create/approve separate Streamarkr Cloudflare Worker and D1 resources.
2. Pin the Cloudflare/Wrangler toolchain and validate the committed migration against Wrangler local D1 before any remote migration.
3. Add/finish Worker personal-data mutation routes as the frontend moves off direct IndexedDB writes.
4. Migrate the PWA data repository to Worker-backed primary state while retaining IndexedDB for cached/offline first paint.
5. Add real provider adapters in focused builds: TMDB first, then Trakt OAuth/history, then streaming availability, always with synthetic contract tests and secrets outside GitHub.

## Remaining V1 limitations
- No live provider integration yet.
- No actual Streamarkr Cloudflare resource or production deployment yet.
- Streaming-service marks are still placeholders pending properly sourced/licensed assets.
- Physical Pixel 9 Pro Fold QA remains required before V1 release.
