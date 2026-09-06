# Streamarkr — Build Progress

Local-only PWA for personal movie/series tracking. No Cloudflare, no live provider APIs, no
deploy, nothing outside this folder. Plain TypeScript compiled to ES modules (no bundler),
IndexedDB standing in for D1, fake provider adapters standing in for Trakt/TMDB/Streaming
Availability. See `AGENTS.md` for permanent engineering rules, `docs/STREAMARKR_STATE.md` for the
current implemented state, and `docs/STREAMARKR_DECISIONS.md` for why things are built this way.

This document covers two corrective passes performed on top of the original V1 build: an
18-item pass (see "Corrections — pass 1" below) and a narrower 9-item follow-up pass that an
independent code review flagged after pass 1 (see "Corrections — pass 2 (final narrow pass)").

## Environment note — and what it means for the architecture
Neither this cloud build session nor the connected computer has npm registry access — Vite,
Vitest, and vite-plugin-pwa (the build plan's actual targets) are not installable here. **This is
a temporary environment limitation, not a permanent architectural decision**: the build plan's
target remains Vite + a Cloudflare Worker + Cloudflare D1 (+ optional R2) + real provider
adapters + GitHub CI, and migrating to that is expected future work once registry/Cloudflare
access exists. In the meantime, the shipped **app itself** has zero external runtime npm
dependencies by design (worth keeping even after migrating): `tsc` compiles straight to `dist/`,
`sw.js`/`manifest.webmanifest` are hand-written, and `server.mjs` is a ~30-line dependency-free
static file server. The **build/test toolchain**, however, is not dependency-free — `tsc`
(for `npm test`), and Playwright (for `browser-qa.mjs`) are now pinned as repository
`devDependencies` for GitHub CI. This takeover runtime still cannot reach the npm registry, so it
cannot generate a lockfile locally. The first baseline CI therefore uses the exact pinned versions
with `npm install`; add `package-lock.json` and switch CI to `npm ci` as soon as a registry-enabled
environment is available.

## Corrections — pass 1 (18-item)

| # | Item | Status |
|---|------|--------|
| 1 | Alert engine (full type set, real change detection) | COMPLETED (see pass 2 fix #3 below — still had a real-change-detection gap) |
| 2 | New-season-doesn't-move-status regression | COMPLETED (see pass 2 fix #1 below — the fix itself had a regression) |
| 3 | Home On Hold "S0" bug + correct season/progress | COMPLETED |
| 4 | Search: poster/logos/availability, non-blocking | COMPLETED |
| 5 | My Library: current-availability logos, no history leak | COMPLETED |
| 6 | Discover card completion (genre/year/type/logos/why/trailer) | COMPLETED |
| 7 | By Genre personalization (rating-weighted ranking) | COMPLETED |
| 8 | Trailer action (graceful open/disable) | COMPLETED |
| 9 | Primary streaming action on Detail | COMPLETED |
| 10 | Relevant season selection (shared, tested logic) | COMPLETED |
| 11 | Real streaming-service brand logos (local, safe) | COMPLETED as a placeholder — see pass 2 fix #8: NOT the final logo design |
| 12 | PWA first-offline reliability (install-time full cache) | COMPLETED |
| 13 | Touch target / accessibility pass | COMPLETED — see pass 2 fix #5: several controls were still under 44px |
| 14 | Data export completeness | COMPLETED |
| 15 | IndexedDB/repository integration test | COMPLETED (own polyfill, see below) |
| 16 | Browser QA | COMPLETED (`browser-qa.mjs`, 19/19 passing) |
| 17 | Pixel 9 Pro Fold responsive QA | COMPLETED (344×792 / 873×1000, see TESTS.md) |
| 18 | Project continuity files | COMPLETED — see pass 2 fix #6/#7/#8: the framing needed correcting |

## Corrections — pass 2 (final narrow pass, after independent code review)

| # | Item | Status |
|---|------|--------|
| 1 | Caught Up status semantics (older-season gaps must not be masked) | COMPLETED |
| 2 | On Hold must use real watching activity, not override `changedAt` | COMPLETED |
| 3 | Series alert change detection (no current-state re-announcing) | COMPLETED |
| 4 | Reconcile provider availability snapshots (remove stale rows) | COMPLETED |
| 5 | Finish touch-target pass (segmented/toggle/stars/action buttons) | COMPLETED |
| 6 | Fix "temporary looks permanent" framing in continuity docs | COMPLETED |
| 7 | Honest test-toolchain documentation (tsc/Playwright are external) | COMPLETED |
| 8 | Streaming logo status — explicitly a placeholder, not final | COMPLETED |
| 9 | Search→Library future-integration note + dangling-titleId guard | COMPLETED |

The synthetic/local scope is complete enough for a reviewed baseline; real providers, Cloudflare, licensed logos, GitHub CI, and physical-device QA remain future integration work.

## What changed, by area
- **`src/lib/season-select.ts`** (new) — single shared source of truth for "which season is
  relevant right now," used by both the status engine and the Detail Episodes tab. Fixes the
  Home "S0" bug and the Episodes-tab-jumps-to-wrong-season bug together, from one root cause.
- **`src/lib/status.ts`** — series status now keys off the "engaged season" (the highest season
  with ≥1 actually-watched episode), so a newly announced/released season no longer moves a
  Caught Up series to Watching/On Hold on its own.
- **`src/lib/alerts.ts` + `src/lib/repo.ts`** — full alert type coverage with real change
  detection: previous vs. current availability/release snapshots are persisted in `meta` and
  diffed each sync, rather than re-asserting current truth every time.
- **`src/lib/discover.ts`** — `DiscoverCard` now carries genre/year/mediaType/availability/
  trailerKey; ranking uses a rating-weighted `preferenceScore()` (5-star matches count far more)
  everywhere, including By Genre.
- **`src/ui/logos.ts`** (new) — locally-defined, brand-colored service badges (no external asset
  host, no trademark-reproduction risk) used consistently across Preferences, Search, My Library,
  History, Discover, and Detail.
- **`src/ui/trailer.ts`** (new) — shared dismissible trailer overlay; the previously-broken Watch
  Trailer button now works on Detail and Discover cards, and is disabled (not dead) with no
  trailer.
- **`src/ui/screens/search.ts`, `library.ts`, `discover.ts`, `detail.ts`, `history.ts`,
  `settings.ts`** — availability logos, primary streaming action, trailer wiring, aria-labels/
  aria-pressed/aria-checked, export completeness, and version bump.
- **`src/styles/main.css`** — per-component touch-target enlargement (not a blanket rule — see
  `docs/STREAMARKR_DECISIONS.md` for why), trailer overlay styles, primary-stream-action styles,
  `:focus-visible`/`.sr-only`, dead `.service-logo`/`.logo-row` CSS removed.
- **`sw.js` + `generate-sw-manifest.mjs`** (new script) — install-time caching now includes every
  compiled JS module (via a build-time-generated manifest), not just the static shell.
- **`tests/fake-indexeddb.ts` + `tests/repo-integration.test.ts`** (new) — a small, owned
  in-memory IndexedDB polyfill and a real integration test suite against `repo.ts` + `db.ts`,
  replacing the previously-blocked external `fake-indexeddb` package dependency.
- **`browser-qa.mjs`** (new, committed) — deterministic Playwright smoke test covering every main
  route plus a Detail-page/trailer journey, and responsive checks at folded (344×792) and
  unfolded (873×1000) viewports.

## What changed in pass 2 (final narrow pass)
- **`src/lib/status.ts`** — Caught Up now requires every released episode in the engaged season
  **and every season at or before it** to be watched, fixing a regression where an older season's
  gap (e.g. S1E2 unwatched) was masked by a fully-watched newer season (e.g. S2). The On Hold
  14-day check now uses `resolve.lastRealWatchedAt()` (provider events only) instead of
  `resolve.lastActivityAt()` (which included manual-override `changedAt`), so toggling an
  episode's watched state no longer fabricates recent viewing activity for the On-Hold timer; with
  no genuine provider timestamp at all, the check conservatively stays Watching rather than
  inventing a date.
- **`src/lib/alerts.ts` + `src/lib/repo.ts`** — `ReleaseSnapshot` now records three independent
  facts per season (`exists`, `airDate`, `available`) instead of a single air-date map, so "season
  didn't exist yet" is never collapsed into "season exists with no date." The season-alert code no
  longer calls `computeNewSeasonEntry` (a pure function of current state) to decide whether to
  alert — every season alert now comes from a genuine previous-vs-current diff, so an
  already-known upcoming season no longer re-announces itself every sync, including on the very
  first sync where previous equals current by construction.
- **`src/lib/repo.ts`** — `syncNow()` now calls `reconcileAvailability()` instead of a bare
  `putAll()`, so a provider snapshot that drops a title/service pairing removes the stale row
  instead of leaving it behind forever. `addToLibrary()` now requires a matching `titles` record
  to exist and throws otherwise, preventing a dangling Library membership once Search calls a real
  provider (documented inline with the intended real search→library flow).
- **`src/styles/main.css`** — re-measured touch targets with real rendered boxes and fixed four
  controls found still under 44px: `.segmented button` (40px → 44px), `.action-btn` (no
  min-height → 44px), `.star` (added an invisible `::before` 44×44 tap target), and the Settings
  `.toggle` switch (added the same). `.pill`, `.tab-btn`, `.icon-btn`, `.heart-btn`, and
  `.episode-check` were re-verified and already correct.
- **`AGENTS.md`, `docs/STREAMARKR_STATE.md`, `docs/STREAMARKR_DECISIONS.md`,
  `docs/STREAMARKR_BUILD_STATE.json`** — corrected to state the build plan's actual target
  architecture (Vite + Cloudflare Worker + D1 + real providers + GitHub CI) up front, frame the
  current no-bundler/IndexedDB/fake-adapter setup explicitly as a temporary environment-driven
  substitution rather than a permanent choice, document `tsc`/Playwright honestly as
  currently-global tools rather than pretending the project is dependency-free end to end, and
  mark the streaming-service logos as an explicit placeholder pending real licensed assets.
- **`tests/status.test.ts`, `tests/alerts.test.ts`, `tests/repo-integration.test.ts`** — 21 new
  regression tests covering all of the above (see TESTS.md for the full breakdown); one existing
  test (`status.test.ts`'s override-precedence test) was updated because its assertion encoded the
  now-fixed On-Hold-timing bug rather than correct behavior.


## Independent takeover hardening pass (v0.10.2)
Completed after the Claude-generated baseline was independently reviewed:
- Bounded season bulk actions: only currently released known episodes are affected; future episodes do not inherit.
- Watching Now sort uses real watched timestamps, not override edit timestamps.
- Rate Now stays visible across Series/Movies when either side has candidates.
- Settings re-entry always lands on Preferences.
- Detail Overview/History/Episodes were completed with progress, next/upcoming context, future-season data,
  expandable synopsis, and separate manual-correction history.
- Provider-known future seasons without episode records now appear in New Season.
- Availability alert dedupe/change detection is cycle-aware and leaving-soon requires a real transition.
- Discover add-to-Library now removes the newly ineligible card instead of presenting a non-working remove state.
- Interactive cards/rows and rating stars received additional semantic/keyboard hardening.
- Test toolchain no longer requires `tsx`; `npm test` compiles tests then runs Node `node:test`.
- Automated validation: **92/92 tests passing** and `npm run build` clean.
- Browser QA script was updated and syntax-checked; Playwright could not be executed in the independent
  takeover runtime, and direct Chromium was unusable there. The previous 19/19 browser result remains a
  historical Claude-run result, not an independent rerun.

## Assumptions made (ambiguous items, build-plan-consistent choices)
- D1 → IndexedDB, as in the original build; `repo.ts` mirrors the plan's table boundaries 1:1.
- The primary "Open in `<Service>`" Detail action only ever renders for a subscription option
  with both a deep link and a user-selected service — no best-guess fallback service is ever
  shown as if actionable.
- Streaming-service logos are locally-defined brand-colored badges with short wordmarks, not
  reproductions of the real trademarked artwork and not fetched from any external host — chosen
  deliberately for IP safety over pixel-perfect recognizability. **This is an explicit placeholder
  for this offline build, not the final visual design** — real, properly licensed streaming-service
  logos are still pending for the real visual/provider integration phase.
- Touch-target enlargement is achieved per-component (direct resize where there's room, invisible
  `::before` tap-target expansion where the icon must stay small) rather than a blanket CSS rule,
  to avoid visually enlarging the intentionally compact pill/tab/select rows.
- The IndexedDB integration test uses a small hand-written in-memory polyfill rather than the
  blocked external `fake-indexeddb` package — this is a genuine integration test against the real
  `repo.ts`/`db.ts` code, not a fake pass.

## Known limitations
- No real Trakt/TMDB/Streaming Availability integration, no Cloudflare Worker/D1/R2 yet — this is
  a consequence of this environment having no npm registry/Cloudflare access, not a permanent
  design choice; the build plan's target architecture explicitly calls for all of these.
- `typescript` and `playwright` are pinned as repository `devDependencies`, but the lockfile is still
  pending because this takeover runtime cannot reach npm. Initial GitHub CI uses `npm install`; add
  `package-lock.json` and switch to `npm ci` after the first registry-enabled install.
- Streaming-service logos (`src/ui/logos.ts`) are colored-badge placeholders, not final licensed
  brand assets — explicitly pending, see `docs/STREAMARKR_DECISIONS.md`.
- No physical Pixel 9 Pro Fold device was used; responsive QA used emulated viewports at 344×792
  (folded) and 873×1000 (unfolded) via Playwright, which is the closest available proxy in this
  environment. See `TESTS.md` for exact checks performed.
- The Discover recommendation engine re-ranks the local synthetic fixture catalogue; it does not
  call a live TMDB recommendations/similar endpoint — acceptable per the build plan for local QA.
- Watch Trailer opens a local dismissible overlay (title name + a play icon), not a real video
  player — no live video API is available or permitted in this project.
- `tests/fake-indexeddb.ts` covers only the IndexedDB usage pattern `db.ts` actually needs
  (get/getAll/put/putAll/delete/clear, single/compound keyPaths) — no cursors, no indexes, no
  range queries. Extend it if `db.ts`'s usage pattern grows.

## How to run locally
```
npm run build      # compiles src/ (TypeScript) -> dist/, regenerates sw-manifest.json
node server.mjs    # serves the app at http://localhost:8787, no dependencies required
```
`dist/` is committed as-built, so `node server.mjs` alone is enough to try it immediately;
re-run `npm run build` after editing anything under `src/`.

## How to run tests
```
npm test                 # compile tests with tsc, then node --test — 92 tests, all passing
node browser-qa.mjs       # Playwright smoke + responsive QA (server must already be running)
```
`typescript` and Playwright are declared as exact repository `devDependencies`. This takeover
runtime cannot fetch them from npm, so local validation here used the already-available compiler;
GitHub CI will install the pinned tools. See `TESTS.md` for full coverage detail.

## GitHub baseline establishment (2026-09-06)
- Public repository `mstpln/streamarkr` created with an initial README on `main`.
- Baseline import is prepared for branch `feat/establish-streamarkr-baseline-v0102`; no merge or deployment is authorized.
- Added repository-local TypeScript/Playwright devDependency declarations, deterministic GitHub CI, public-repo `.gitignore`, and the authoritative build-plan text companion under `docs/`.
- Package lock remains pending because this takeover runtime cannot reach the npm registry; first CI uses exact pinned versions with `npm install` and will validate registry resolution.
