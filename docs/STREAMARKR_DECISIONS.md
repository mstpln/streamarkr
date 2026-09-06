# Streamarkr durable decisions

## Product/data boundaries
- History is provider ingestion and may contain shared-family viewing; My Library is the user's intentional collection.
- Heart means My Library membership, not liking. Removing from Library preserves History, ratings, and manual corrections.
- One 1-5 star rating per whole movie/series; no season or episode ratings.
- Manual watched/unwatched corrections are user-owned and authoritative over provider watch state until changed by the user.
- A manual correction timestamp is provenance, not a viewing timestamp and must not affect Watching Now recency or the 14-day On Hold timer.
- Provider refreshes may reconcile provider-owned metadata/availability but must never overwrite user-owned state.
- Stable provider IDs/crosswalks must be preserved so provider data can change without replacing local identity.

## Series status semantics
- To Watch: in Library, not started.
- Watching: actual viewing has engaged a season and released unwatched episodes remain.
- On Hold: engaged/Watching, released unwatched episodes remain, and no real watch activity for 14 days.
- Caught Up: all released episodes through the highest engaged season are watched. An entirely untouched newer season does not move a Caught Up series back to Watching/On Hold.
- Finished: all episodes watched and provider series status is Ended.
- `src/lib/season-select.ts` is the single source of truth for engaged/relevant season selection.
- Season bulk watched/unwatched actions are bounded snapshots over currently known released episodes. They must not create wildcard state affecting future episodes.

## Alerts
- Alerts are in-app only; no push notifications in V1.
- Keep newest 30 alerts; unseen indicators persist for the current Alerts visit and are marked seen after leaving.
- Alert generation is based on persisted before/after transitions, not repeated assertion of current truth.
- New-episode alerts apply only to series currently Watching.
- Availability alert identities are cycle-aware so a title can legitimately leave and later return on the same service.

## Streaming and Discover
- Preferences initial service choices: Netflix, HBO Max, Disney+, Prime Video, SkyShowtime, Apple TV, Viaplay, TV4 Play.
- Current availability is provider-owned; historical "where I watched it" is optional user-owned state per title.
- Discover only includes subscription-included titles on one of the user's selected services. No rent/buy-only recommendations.
- Discover excludes titles already in History or My Library.
- Top Picks uses 5-star titles; Similar To can use any Library title and remains same media type; By Genre uses rating/preference weighting.

## Architecture
- Target: Vite + TypeScript PWA, separate Cloudflare Worker, separate D1, optional separate R2 only if needed, real provider adapters, GitHub CI.
- Current plain-TypeScript + IndexedDB + fake-provider implementation is a temporary reviewed baseline, not a permanent prohibition on Vite/Cloudflare migration.
- The first GitHub PR establishes the validated v0.10.2 baseline and CI only; do not combine that import with the Worker/D1 migration.
- Current IndexedDB availability key `[titleId, serviceKey]` cannot represent simultaneous option types for the same service; redesign the provider-owned availability table during D1 migration.

## Repository/security
- Repository is public: `mstpln/streamarkr`.
- Only source, documentation, and synthetic fixtures may be committed.
- Never commit API keys, OAuth secrets/tokens, Cloudflare credentials, `.env`/`.dev.vars`, or personal History/Library/ratings/runtime data.
- Real secrets belong in GitHub/Cloudflare secret stores/environment bindings.
- Automated QA remains synthetic and never calls live providers or production data.

## UI/QA
- Primary visual mode is dark, contemporary, premium, poster-led, with violet/electric-blue and pink/coral accents.
- Pixel 9 Pro Fold is the primary device target; test both folded and unfolded widths without merely stretching mobile layouts.
- Important controls target ~44x44 CSS px effective touch areas; icon-only actions need accessible labels/focus behavior.
- Streaming-service badges in `src/ui/logos.ts` are placeholders; final app should use properly sourced/licensed recognizable logos.
- App/runtime version and service-worker cache version must stay synchronized; one user-visible/architectural build = one bump, focused corrections to the same unreleased build keep the version.

## Current test/tooling decision
- Baseline tests compile with TypeScript then use Node's built-in `node:test`; browser QA uses Playwright.
- `typescript` and `playwright` are pinned devDependencies and `package-lock.json` is committed.
- GitHub CI uses Node 22 and `npm ci` so dependency installation is reproducible.
- Browser QA remains deterministic and synthetic-only; physical device QA is separate and still required before V1 release.
