# Streamarkr current state

Updated: 2026-09-07. Current build: **v0.10.2** / service-worker cache **streamarkr-v0.10.2**.

## Implemented baseline
- Installable local PWA shell with Home, Discover, My Library, History, Search, Alerts, Settings, and universal movie/series detail pages.
- TypeScript source compiled to native ES modules; IndexedDB is the temporary local data store standing in for future D1.
- Fake TMDB, Trakt, and Streaming Availability adapters with synthetic fixtures only.
- User-owned Library membership, 1-5 star ratings, manual watched/unwatched overrides, selected streaming services, historical watched-service, and alert seen state.
- Status engine: To Watch, Watching, On Hold, Caught Up, Finished, including 14-day On Hold and untouched-new-season semantics.
- Home: Watching Now/On Hold, Rate Now, New Season.
- Library: Series/Movies, sorting/filtering, poster grid, current availability badges.
- History: one row per title, progress, known watched date, historical service.
- Search: All/Series/Movies, availability and Library heart.
- Detail: Overview/Episodes/Streaming/History for series; Overview/Streaming/History for movies; season pills, episode rows, manual corrections, trailer placeholder action, primary streaming deep-link when valid.
- Discover: Top Picks, Similar To, By Genre; excludes History/Library and requires subscription availability on a selected service.
- Alerts: transition-based season/episode/release/availability/leaving-soon alerts, seen lifecycle, 30-item retention.
- Offline shell/service worker with generated compiled-module manifest.
- Responsive dark UI targeted at Pixel 9 Pro Fold; streaming-service marks are still placeholders, not final licensed logos.

## Validation
- GitHub CI on PR #1 uses Node 22 and reproducible `npm ci` from committed `package-lock.json`.
- Build: PASS.
- Automated logic/repository tests: **92/92 PASS**, 22 suites.
- Playwright browser/responsive QA: **25/25 PASS** at mobile, folded, and unfolded target sizes, with no browser console/page errors in the smoke journey.
- Physical Pixel 9 Pro Fold QA has not yet been performed.

## Repository state
- Public repo: `mstpln/streamarkr`.
- Baseline branch: `feat/establish-streamarkr-baseline-v0102`.
- Baseline PR: **#1**, open, mergeable, awaiting explicit user merge authorization after final review.
- `main` still contains only the user-created initial repository state; no baseline merge has occurred.
- No Cloudflare resources, provider secrets, or personal viewing data are connected or committed.

## Target architecture still pending
The build plan target remains Vite + TypeScript, a separate Cloudflare Worker, separate D1 database, optional R2 if justified, and real Trakt/TMDB/Streaming Availability adapters. The current IndexedDB/fake-provider baseline is temporary and exists to preserve already-validated product/domain behavior while that migration is done in focused builds.

## Known limitations / next work
- Migrate to Vite/Worker/D1 in focused builds rather than combining it with this baseline import.
- Add real TMDB, Trakt OAuth/history, and streaming-availability integrations without violating ownership boundaries.
- Replace placeholder service badges with properly sourced/licensed service logos.
- Redesign provider-owned availability schema during D1 migration so one title/service can represent multiple option types safely.
- Run physical Pixel 9 Pro Fold QA before V1 release.
