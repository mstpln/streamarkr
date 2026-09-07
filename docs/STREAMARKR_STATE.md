# Streamarkr current state

Updated: 2026-09-07. Current build: **v0.10.2** / service-worker cache **streamarkr-v0.10.2**.

## Implemented baseline
- Installable synthetic/local PWA shell with Home, Discover, My Library, History, Search, Alerts, Settings, and universal movie/series detail pages.
- TypeScript source compiled to native ES modules; IndexedDB is the temporary local data store standing in for future D1.
- Fake TMDB, Trakt, and Streaming Availability adapters with synthetic fixtures only.
- User-owned Library membership, 1-5 star ratings, manual watched/unwatched overrides, selected streaming services, historical watched-service, and alert seen state.
- Status engine: To Watch, Watching, On Hold, Caught Up, Finished. Finished requires provider series status `Ended`; an untouched newer season does not break Caught Up; On Hold uses real watch timestamps only.
- Season bulk corrections affect only currently known/released episodes, never future episodes.
- Home: Watching Now/On Hold, Rate Now with cross-media fallback, and New Season including future seasons known before episode records exist.
- Library: Series/Movies, sorting/filtering, poster grid, current availability badges. Service filtering uses real represented availability even when a service is not selected in Preferences.
- History: one row per title, progress, known watched date, persistent historical watched-service. Historical service filtering/display survives later service deselection.
- Search: All/Series/Movies, availability and Library heart, with Library-integrity protection against dangling title IDs.
- Detail: Overview/Episodes/Streaming/History; progress/release context, relevant season selection, expandable episode synopsis, manual corrections separated from provider history, trailer action, and a primary streaming action that prefers selected subscription services but falls back to another actionable subscription service.
- Discover: Top Picks, Similar To, By Genre; excludes History/Library and requires subscription availability on a selected service.
- Alerts: transition-based season/episode/release/availability/leaving-soon alerts, 30-item retention, and NEW indicators that remain visible throughout the first Alerts visit and are persisted as seen on page exit.
- User-data export includes user-owned records plus stable title/provider crosswalk IDs needed to reconnect data safely.
- Offline shell/service worker with generated compiled-module manifest.
- Responsive dark UI targeted at Pixel 9 Pro Fold; streaming-service marks remain placeholders, not final licensed logos.

## Validation
- GitHub CI on PR #1 uses Node 22 and reproducible `npm ci` from committed `package-lock.json`.
- Build: **PASS**.
- Automated logic/repository tests: **101/101 PASS**, **26 suites**, 0 failures/skips/todos.
- Playwright browser/responsive QA: **27/27 PASS**, including Alerts seen lifecycle, folded/unfolded checks, and no browser console/page errors in the smoke journey.
- Current build generates a service-worker manifest covering **29 compiled modules**.
- Physical Pixel 9 Pro Fold QA has not yet been performed.

## Repository state
- Public repo: `mstpln/streamarkr`.
- Baseline branch: `feat/establish-streamarkr-baseline-v0102`.
- Baseline PR: **#1**, open and in final review. It must not be merged without explicit user authorization.
- `main` has not received the baseline yet; no deploy has occurred.
- No Cloudflare resources, provider secrets, or personal viewing data are connected or committed.

## Target architecture still pending
The build plan target remains Vite + TypeScript, a separate Cloudflare Worker, separate D1 database, optional R2 if justified, and real Trakt/TMDB/Streaming Availability adapters. The current IndexedDB/fake-provider baseline is temporary and exists to preserve validated product/domain behavior while that migration is done in focused builds.

## Known limitations / next work
- Migrate to Vite/Worker/D1 in focused builds after the baseline is merged.
- Add real TMDB, Trakt OAuth/history, and streaming-availability integrations without violating ownership boundaries.
- Replace placeholder service badges with properly sourced/licensed service logos.
- Redesign provider-owned availability identity during D1 migration so one title/service can represent multiple option types safely.
- Run physical Pixel 9 Pro Fold QA before V1 release.
