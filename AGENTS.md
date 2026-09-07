# AGENTS.md — Streamarkr permanent engineering rules

This file is for any engineer or agent working on this codebase after this session. It states
durable rules, not a status report — see `docs/STREAMARKR_STATE.md` for what's currently
implemented and `docs/STREAMARKR_DECISIONS.md` for why things are the way they are.

## What this project is
A personal movie/series tracking PWA, built against `docs/STREAMARKR_BUILD_PLAN.md`.
The **authoritative target architecture** from that build plan is:
- Vite + TypeScript for the PWA build
- a Cloudflare Worker as the backend
- Cloudflare D1 as primary storage (optional R2 for larger assets)
- IndexedDB as the browser cache/offline layer
- real provider adapters (Trakt, TMDB, a streaming-availability API)
- GitHub for source control and CI/QA

The project began as a reviewed synthetic/local stand-in because the original Cowork build
environment had no npm registry access — every `npm install` attempt there returned
`403 host_not_allowed`. That originally blocked Vite, Vitest, and vite-plugin-pwa, so the current
PWA still compiles plain TypeScript straight to ES modules, tests compile through
`tsconfig.tests.json` and run on Node's built-in `node:test` runner, and
`sw.js`/`manifest.webmanifest` remain hand-written.

The backend foundation is no longer hypothetical: the dedicated Streamarkr Cloudflare Worker and
D1 database exist and have been activated. The active browser runtime still deliberately uses
fake provider adapters until the real PWA origin/authentication and complete Worker mutation
surface are ready. IndexedDB must now be treated as the browser cache/offline layer, not as a
permanent second source of truth parallel to D1.

**The remaining local/synthetic pieces are temporary migration boundaries, not permanent
architectural decisions.** Migrating to the build plan's complete real-provider architecture is
expected work, not something to avoid or need special permission to propose. Nothing in this file
should be read as "keep the temporary piece forever."

## Build / run / test commands (current baseline)
```
npm ci            # install exactly from committed package-lock.json
npm run build     # tsc -p tsconfig.json -> dist/ (also regenerates sw-manifest.json)
node server.mjs    # serve at http://localhost:8787
npm test           # compile tests with tsc, then run Node's built-in node:test runner
npm run qa:browser # Playwright smoke + responsive QA (requires the server running)
```
The **app runtime** intentionally has no third-party runtime dependencies in this baseline. The
build/test toolchain is repository-declared: `typescript`, `playwright`, and pinned Wrangler are
in `devDependencies`, `package-lock.json` is committed, and GitHub CI uses Node 22 plus `npm ci`
before build/test/browser QA. Keep the lockfile synchronized with any dependency change; do not
switch CI back to `npm install` unless there is a specific, documented reason.

## Architecture boundaries — do not blur these
- `src/lib/*` is pure domain/data-boundary logic (status engine, alerts, discover ranking, season
  selection, resolve, history, browser repository/cache bridge). It must stay UI-framework-free.
  Provider access is allowed only through explicit provider/backend interfaces; never import from
  `src/ui/*` into `src/lib/*`.
- `src/lib/backend-contract.ts` is the shared Worker/browser snapshot contract;
  `src/lib/backend-client.ts` is the browser transport seam; `src/lib/backend-cache.ts` is the
  Worker-snapshot-to-IndexedDB cache bridge. UI code must not call Worker endpoints directly.
- A complete authenticated `BackendSnapshot` may atomically replace the related IndexedDB cache
  because it represents one D1 source-of-truth snapshot. This is distinct from a provider refresh:
  provider refresh code must still never touch user-owned state.
- A failed backend fetch must leave the existing IndexedDB cache untouched. Never clear valid
  offline data before a replacement snapshot has been fetched and validated.
- A cache marked as backend-hydrated must never be overwritten by synthetic fixture seeding on a
  later offline startup.
- `src/ui/screens/*.ts` are the only place fake provider adapters (`TmdbAdapter`, `TraktAdapter`,
  `AvailabilityAdapter`) may be called directly from outside `repo.ts`/`alerts.ts` — e.g. Search's
  live-typeahead. Never let a fake-provider call leak into `src/lib/status.ts`, `alerts.ts`,
  `discover.ts`, or `season-select.ts` — those must only see already-fetched snapshots passed in
  as plain data, so they stay deterministic and unit-testable. This is the provider seam that real
  adapters replace later.
- `src/lib/season-select.ts` is the single source of truth for "which season is relevant /
  engaged right now." Both the status engine (`status.ts`) and the UI (Home cards, Detail
  Episodes tab) must call into it rather than re-deriving season logic locally. If you need a new
  season-selection rule, change it there once.
- `src/ui/logos.ts` is the only place service-brand colors/marks are defined. Every screen that
  shows a streaming-service badge must call `serviceLogoHtml()` — never re-implement a glyph
  badge inline. See "Streaming-service logos" below — these are placeholders, not final assets.
- **Library membership integrity**: `repo.addToLibrary()` refuses to create a `library_items` row
  for a `titleId` with no corresponding `titles` record. Never bypass this by writing directly to
  `library_items` from UI code.

## User-owned data vs provider-owned data
User-owned (never overwritten by a **provider refresh**, always authoritative over provider state):
library membership, ratings, manual watch overrides (episode/season/movie), watched-service
("where I watched it"), alert seen-state, selected streaming services.

Provider-owned (safe to fully reconcile on provider sync): title/season/episode metadata,
availability snapshots, watch *events* (Trakt history — overrides still win when resolving watched
state).

A full D1 `BackendSnapshot` is different from provider reconciliation: once backend mode is
activated, D1 is the durable authority for both user-owned and provider-owned rows, so one complete
validated snapshot may replace the corresponding browser cache stores atomically. Do not confuse
that operation with `syncNow()`/provider refresh semantics.

Never write a provider-refresh path that touches a user-owned store. Never let UI code write
directly to `db.ts` — always go through `repo.ts`'s named mutation functions so ownership stays
enforced in one place. Before enabling production backend mode, every user-facing mutation that
can change durable state must either have a Worker-backed path or be deliberately disabled; do not
allow local-only edits that will silently disappear on the next D1 snapshot refresh.

## Browser cache schema / migration safety
- IndexedDB is disposable only for provider-owned/cache-only rows. User-owned rows must survive
  IndexedDB version migrations unless a separately reviewed data migration intentionally transforms
  them.
- Browser availability identity must match D1 semantics: `(titleId, serviceKey, optionType)`. A
  title may have subscription and rent/buy options on the same service simultaneously.
- The v1 -> v2 IndexedDB migration is allowed to recreate only `availability`, because it is
  provider-owned cache data and its key changed. Do not broaden that deletion to user-owned stores.
- Cache schema/version migrations need deterministic regression tests that explicitly prove
  user-owned rows survive.

## Manual override precedence — and what it is NOT authoritative for
`resolve.ts` (`resolveEpisode`, `resolveMovie`) is the only place "is this actually watched"
should be computed from raw events + overrides. Overrides always win over provider watch events
for **watch state**. Anything that needs "did the user watch X" must call through `resolve.ts`,
never re-derive it.

But a `WatchOverride.changedAt` is correction **provenance** (when the user made this correction),
never a substitute **watched timestamp**. Never treat `changedAt` as "watched now" for any
time-based rule — the 14-day On Hold check in `status.ts` deliberately uses
`resolve.lastRealWatchedAt()` (provider events only) rather than `resolve.lastActivityAt()`
(which includes override `changedAt` and is retained only for correction/activity provenance, not Watching Now recency or On Hold).
If a title has only manual watch state and no genuine provider timestamp, do not invent one —
treat that as "cannot judge staleness" rather than guessing a date.

## Season status semantics (the tricky one — read this before touching status.ts)
Caught Up means every released episode in the season the user has actually engaged with **and
every season at or before it** is watched — not just the highest-touched season itself. An older
season with a gap must NOT be masked by a fully-watched newer season. Conversely, an entirely
untouched newer season (zero watched episodes there) must NOT drag a Caught Up series down into
Watching/On Hold — it simply isn't "engaged" yet. `season-select.ts`'s `engagedSeasonNumber()` is
what defines "engaged"; `status.ts` checks all released episodes with `seasonNumber <= engaged`.

## Season bulk watch actions are bounded snapshots
A user action such as "Mark season watched" or "Mark season unwatched" applies only to the
currently known, currently released episodes in that season. `repo.setSeasonOverride()` must
materialize episode-level overrides for that bounded set and must not create a permanent
season-wide wildcard that would automatically affect future episodes added later. Legacy wildcard
overrides may still be read for compatibility, but new UI writes must not create them.

## Alert change detection — never re-assert current truth
Every alert in `alerts.ts` must come from a genuine before-vs-after transition on a persisted
`ReleaseSnapshot`/availability snapshot, never from re-declaring whatever the current provider
state already says. `ReleaseSnapshot.seasons[key]` distinguishes three separate facts per season —
`exists`, `airDate`, `available` — and each has its own diff rule (season discovered, release date
added/changed, season became available). Do not collapse "season doesn't exist yet" and "season
exists with a null date" into the same state, or a season's very first appearance in the catalogue
becomes indistinguishable from an already-known dateless season. On the very first sync,
`previousRelease`/`previousAvailability`/`previousCheckAt` are seeded equal to the current
snapshot specifically so nothing already-true gets retroactively announced as new.

## Availability alert cycles
`now_available` and `leaving_soon` alerts must represent real transitions, not static truth. A title
may legitimately become available, leave, and later return on the same service; dedupe keys must
therefore include the relevant availability cycle/date rather than permanently suppressing future
alerts for that title/service pair. Leaving-soon fires only when entering the configured window or
when the provider supplies a genuinely new leaving date.

## Testing rules
- Every new piece of domain/data-boundary logic needs a `node:test` test in `tests/`, using
  `tests/expect-shim.ts` where its vitest-like helpers are useful.
- `tests/fake-indexeddb.ts` is a minimal in-memory IndexedDB polyfill covering only the narrow
  usage pattern `src/lib/db.ts` actually needs, including versioned upgrade/delete-store behavior
  required for cache-migration tests. Extend this polyfill rather than casually introducing a
  dependency just for convenience; if the test architecture is deliberately modernized later, do
  it as a focused change and retire the polyfill cleanly.
- Never use live network calls, real API credentials, or personal/real data in any test or
  fixture — including after real provider adapters are introduced. Provider-integration tests
  must run against sandboxed/synthetic accounts or recorded fixtures, never production credentials
  or a real person's account data.
- Backend cache bridge tests must use synthetic `BackendClient`/snapshot data and must never call
  the real Worker or real D1.
- `browser-qa.mjs` is the committed Playwright smoke + responsive QA script. Keep it deterministic
  (synthetic fixtures only) and keep it passing before calling any UI change done.

## Version / cache sync rule
`sw.js`'s `CACHE_VERSION` must be bumped whenever a change could affect what's cached (new
compiled file, changed shell asset). `sw-manifest.json` is regenerated automatically by
`npm run build` (via `generate-sw-manifest.mjs`) and lists every compiled JS module so the
service worker's `install` handler can pre-cache the entire module graph — never assume
runtime/fetch-time caching alone will make the app offline-usable after first load; the install
step must do it. Keep `package.json`'s `version` field, `sw.js`'s `CACHE_VERSION`, and the version
string shown in Settings → Data in step with each other when bumping.

## Streaming-service logos — placeholders, not final assets
`src/ui/logos.ts` currently renders brand-colored initials/wordmarks (e.g. "N" for Netflix, "MAX"
for HBO Max) rather than the real trademarked logo artwork, and never fetches from an external
asset host. This is an acceptable placeholder for this synthetic/local build, but it is **not**
the final visual design — the product intent is real, recognizable streaming-service logos in the
shipped app. When real provider/visual integration happens, replace these with properly licensed
brand assets (and confirm usage terms with each service) rather than continuing to ship the
colored-badge placeholders indefinitely. Do not download unverified logo image files from the
internet as a shortcut for this — get real assets through a proper, license-checked source.

## Security / secrets
Never introduce a real API key, OAuth client secret, credential, production device token, or real
D1 identifier into this repository. The production PWA must not embed `DEVICE_ACCESS_TOKEN` in
public source, generated JS, HTML, service-worker caches, logs, or committed configuration. A safe
browser authentication/bootstrap design is required before the real Worker-backed browser mode is
enabled. Provider credentials remain Worker-side secrets. Any live-provider test must use
sandboxed/synthetic test accounts — never production credentials or real personal data.

## Cloudflare production safety
- Streamarkr production resources are Worker `streamarkr-api` and D1 `streamarkr`; never access,
  bind, inspect, reuse, migrate or modify BANDMARKR resources.
- Normal `main` merges do not deploy production. `deploy/production` is the only Workers Builds
  production trigger and may be advanced only after fresh explicit user authorization.
- A previous deployment authorization is consumed by the deployment it authorized and must never
  be reused for a later commit.
- `APP_ORIGIN` stays unset until the actual PWA hosting origin is known; do not invent one.

## Accessibility / responsive targets
- Interactive controls need an effective touch target of at least 44×44 CSS px — achieved via
  padding/min-height on the element itself, or an invisible `::before` pseudo-element expansion
  when the visible icon/control must stay visually small (see `.heart-btn::before`,
  `.episode-check::before`, `.star::before`, `.toggle::before` in `main.css`) — never by visually
  enlarging a compact icon/pill/tab row wholesale.
- Icon-only controls need `aria-label`. Toggle/pressed controls need `aria-pressed` or
  `aria-checked`. Focus must stay visible (`:focus-visible` outline in `main.css` — do not remove
  it).
- Layouts must be checked at both a narrow "folded" width (~344–390px) and a wide "unfolded"
  width (~873px, representative of a Pixel 9 Pro Fold's inner display) — no horizontal overflow,
  no absurdly over-stretched cards at the wide breakpoint. `browser-qa.mjs` asserts both.
- Don't assume a control is compliant from its CSS alone — measure the actual rendered box (and
  its `::before`/`::after` pseudo-elements where the visible element is intentionally smaller)
  with a real browser. Re-verify with `getComputedStyle`/`getBoundingClientRect` rather than
  re-reading the CSS alone.

## Do not
- Do not add a bundler, a UI framework, or a runtime npm dependency to the shipped app without an
  explicit decision to do so — but DO expect and plan for the eventual Vite migration described at
  the top of this file; that migration is allowed and anticipated, not forbidden.
- Do not replace synthetic fixtures with real personal data, even temporarily "for testing."
- Do not enable production backend browser mode while durable user mutations still exist only in
  IndexedDB; they would be at risk of being overwritten by the next D1 snapshot refresh.
- Do not update a test's expectation to match incorrect behavior — fix the behavior.
- Do not reach into BANDMARKR or any other unrelated project folder from here.
- Do not present remaining local stopgaps (no-bundler build, colored-badge logos, fake providers)
  as permanent design choices; document what they stand in for and why they're temporary.
