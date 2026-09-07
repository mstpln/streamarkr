# Streamarkr durable decisions

## Product/data boundaries
- History is provider ingestion and may contain shared-family viewing; My Library is the user's intentional collection.
- Heart means My Library membership, not liking. Removing from Library preserves History, ratings, and manual corrections.
- One 1-5 star rating per whole movie/series; no season or episode ratings.
- Manual watched/unwatched corrections are user-owned and authoritative over provider watch state until changed by the user.
- A manual correction timestamp is provenance, not a viewing timestamp and must not affect Watching Now recency or the 14-day On Hold timer.
- Provider refreshes may reconcile provider-owned metadata/availability but must never overwrite user-owned state.
- Stable provider IDs/crosswalks must be preserved so provider data can change without replacing local identity; user export includes those stable crosswalk IDs so exported personal data can be reconnected safely.

## Series status semantics
- To Watch: in Library, not started.
- Watching: actual viewing has engaged a season and released unwatched episodes remain.
- On Hold: engaged/Watching, released unwatched episodes remain, and no real watch activity for 14 days.
- Caught Up: all released episodes through the highest engaged season are watched. An entirely untouched newer season does not move a Caught Up series back to Watching/On Hold.
- Finished: all episodes watched and provider series status is **exactly `Ended`**. `Canceled` does not silently mean Finished.
- `src/lib/season-select.ts` is the single source of truth for engaged/relevant season selection.
- Season bulk watched/unwatched actions are bounded snapshots over currently known released episodes. They must not create wildcard state affecting future episodes.

## Alerts
- Alerts are in-app only; no push notifications in V1.
- Keep newest 30 alerts; no Clear All.
- NEW indicators remain visible throughout the user's first visit to Alerts. That visit's unseen alerts are persisted as seen when the user leaves Alerts, so the next visit and header badge are updated.
- Alert generation is based on persisted before/after transitions, not repeated assertion of current truth.
- New-episode alerts apply only to series currently Watching.
- Availability alert identities are cycle-aware so a title can legitimately leave and later return on the same service.

## Streaming, service filters, and Discover
- Preferences initial service choices: Netflix, HBO Max, Disney+, Prime Video, SkyShowtime, Apple TV, Viaplay, TV4 Play.
- Current availability is provider-owned; historical "where I watched it" is optional user-owned state per title.
- Deselecting a service in Preferences must not erase or hide an already-recorded historical watched-service value in History. History filter/display uses services represented by historical rows, regardless of current selection.
- Library's Streaming Service filter reflects services represented by current availability, not only selected Preferences services. Preference selection affects prioritisation and Discover eligibility, not whether a real current service can be filtered.
- The Detail page's single primary streaming action prefers an actionable subscription link on a selected service, but if none exists it falls back to another actionable subscription service. Rent/buy-only offers are not promoted as the primary action.
- Discover only includes subscription-included titles on one of the user's selected services. No rent/buy-only recommendations.
- Discover excludes titles already in History or My Library.
- Top Picks uses 5-star titles; Similar To can use any Library title and remains same media type; By Genre uses rating/preference weighting.

## Architecture
- Target: Vite + TypeScript PWA, separate Cloudflare Worker, separate D1, optional separate R2 only if needed, real provider adapters, GitHub CI.
- PR #1 established the reviewed v0.10.2 synthetic/local baseline.
- PR #2 / v0.11.0 established the source-level Worker + D1 backend foundation while leaving the working UI on IndexedDB/fake providers.
- PR #3 / v0.12.0 established pinned Wrangler-local D1 runtime validation before remote activation.
- `worker/repository.ts` is the server-side persistence boundary. Worker routes should not contain ad-hoc D1 mutation logic when the operation belongs in the repository layer.
- `src/lib/backend-contract.ts` defines the shared browser/Worker snapshot shape; `src/lib/backend-client.ts` is the browser transport seam. UI modules should migrate through this seam rather than calling Worker endpoints directly.
- Real provider code implements the interfaces in `worker/provider-contracts.ts`; provider credentials remain Worker-only and provider-specific concerns must not leak into UI/domain logic.
- The D1 availability key is `(title_id, service_key, option_type)`. This intentionally fixes the temporary IndexedDB `[titleId, serviceKey]` limitation and allows subscription/rent/buy options to coexist for one service.
- D1 foreign keys use restrictive deletion for durable relationships. Provider refresh code reconciles provider-owned rows; it does not cascade-delete user-owned Library/rating/override/history preference state.
- The initial Worker API exposes a compact snapshot plus a small set of representative personal mutations. Remaining mutations are added as the frontend migrates, rather than duplicating every current IndexedDB function before it is needed.
- `wrangler.local.jsonc` is strictly local-only and may contain only non-production placeholder identifiers.
- Wrangler is pinned to **4.129.0** and local migration validation always runs with `--local` against isolated ignored state.

## Cloudflare activation and deployment
- The dedicated Cloudflare resources are named exactly Worker `streamarkr-api` and D1 `streamarkr`; the Worker binding is `DB`.
- The user explicitly created those resources on 2026-09-07. They must never be replaced with, bound to, or confused with BANDMARKR resources.
- The real D1 UUID remains account/build configuration and must not be committed to the public repository.
- The committed `wrangler.jsonc` remains account-neutral. `scripts/prepare-cloudflare-deploy.mjs` generates the account-specific D1 binding under ignored `.wrangler/deploy/` state from the build-only `STREAMARKR_D1_DATABASE_ID` value.
- Remote deploy preparation must validate the D1 ID as a non-placeholder UUID and must not print it.
- Remote migration/deployment commands explicitly disable Wrangler automatic provisioning and draft-resource auto-creation.
- `DEVICE_ACCESS_TOKEN` is declared as a required Worker secret. The first Streamarkr deployment must fail if it is not configured.
- Wrangler must preserve dashboard-managed runtime variables (`keep_vars: true`) and never remove encrypted Worker secrets as a side-effect of deployment.
- The real `APP_ORIGIN` is not invented before the PWA hosting origin exists. Until configured, cross-origin API access remains denied by design.
- **Normal merges to `main` must not automatically deploy production.** Cloudflare Workers Builds must use a dedicated production deployment branch that is advanced only after explicit user authorization. Non-production branch builds remain disabled for this single-user production Worker.
- A production deployment may apply pending committed D1 migrations immediately before deploying the Worker, but only from an explicitly authorized deployment-branch update after the exact source head has already passed the normal PR review/test cycle.

## Single-user Worker authentication
- Personal-data API routes require a strong bearer device token. The expected value is supplied only as the Worker secret `DEVICE_ACCESS_TOKEN`.
- The Worker fails closed with 503 when authentication has not been configured; it never silently exposes personal routes in a local/open mode.
- `/api/health` may remain public because it returns only service/schema health and whether auth is configured, never user data or credentials.
- Cross-origin browser access is deny-by-default and allowed only for the exact configured `APP_ORIGIN`.
- Worker responses carry request IDs. Unexpected errors may be logged structurally by request ID/route/error class, but raw database/provider error messages, Authorization headers, secrets, OAuth payloads and tokens must not be returned to the browser or written to logs.

## Repository/security
- Repository is public: `mstpln/streamarkr`.
- Only source, documentation, and synthetic fixtures may be committed.
- Never commit API keys, OAuth secrets/tokens, Cloudflare credentials, `.env`/`.dev.vars`, real D1 identifiers that should remain account configuration, or personal History/Library/ratings/runtime data.
- `.dev.vars.example`, `wrangler.example.jsonc`, `wrangler.local.jsonc`, and account-neutral `wrangler.jsonc` may contain no usable credentials or private account identifiers.
- Real secrets belong in GitHub/Cloudflare secret stores/environment bindings.
- Automated QA remains synthetic and never calls live providers or production data.
- Streamarkr Cloudflare resources are always separate from BANDMARKR. Never bind, inspect, reuse, migrate or modify BANDMARKR Worker/D1/R2/secrets/data for Streamarkr.

## UI/QA
- Primary visual mode is dark, contemporary, premium, poster-led, with violet/electric-blue and pink/coral accents.
- Pixel 9 Pro Fold is the primary device target; test both folded and unfolded widths without merely stretching mobile layouts.
- Important controls target ~44x44 CSS px effective touch areas; icon-only actions need accessible labels/focus behavior.
- Streaming-service badges in `src/ui/logos.ts` are placeholders; final app should use properly sourced/licensed recognizable logos.
- App/runtime version and service-worker cache version must stay synchronized; one user-visible/architectural build = one bump, focused corrections to the same unreleased build keep the version.

## Current test/tooling decision
- Application/domain/Worker tests compile with TypeScript then use Node's built-in `node:test`; browser QA uses Playwright.
- `typescript`, `playwright`, and Wrangler **4.129.0** are pinned devDependencies and `package-lock.json` is committed.
- GitHub CI uses Node 22 and `npm ci` so repository dependency installation is reproducible.
- `migrations/0001_initial.sql` is exercised against Node 22 SQLite and pinned Wrangler local D1.
- Remote-deployment configuration tests use only synthetic D1 UUIDs and must never contact Cloudflare.
- Browser QA remains deterministic and synthetic-only; physical device QA is separate and still required before V1 release.
