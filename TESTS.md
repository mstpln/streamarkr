# Streamarkr — Tests

## Compile
```
npm run build
```
Result (last run this session): clean, zero errors.

## Unit / integration tests
```
npm test
```
(`npm test` compiles source/tests through `tsconfig.tests.json`, then runs the emitted JavaScript
with Node's built-in `node:test`. `typescript` and Playwright are pinned as exact repository
`devDependencies`; the lockfile is pending because this takeover runtime cannot reach npm.
Assertions use `tests/expect-shim.ts`, a tiny shim over `node:assert/strict`.)

Result (last run this session): **92 tests, 92 passing, 0 failing**, across 9 test files / 22 suites in the independent takeover run.

### Coverage by file
- `tests/status.test.ts` — series status engine: To Watch/Watching/On Hold/Caught Up/Finished,
  manual-override precedence, New Season card lifecycle, the pass-1 Correction 2 regression suite
  (a newly announced/released season does not move a Caught Up series to Watching/On Hold on its
  own), and the **pass-2 final-pass fix suites**: "Caught Up requires ALL released episodes
  watched, not just the engaged season" (older-season gap + fully-watched newer season is NOT
  Caught Up; fully-watched-through-S2 + untouched new S3 stays Caught Up; watching S3E1 with an
  unwatched S3E2 remaining is Watching, not Caught Up; all-released-watched is Caught Up;
  all-released-watched + Ended is Finished) and "On Hold uses real watching activity, not override
  changedAt" (a same-day manual correction does not fabricate recent activity and correctly
  produces On Hold when the real provider activity is 14+ days old; manual-only watch state with
  no genuine timestamp stays Watching rather than inventing a date; recent real provider activity
  correctly stays Watching).
- `tests/resolve.test.ts` — resolved watch state: override precedence over provider events,
  season-level vs. episode-level override precedence, movies never fabricating a watched date.
- `tests/history.test.ts` — History aggregation, watched/total counts, unknown-date handling,
  Recently-Watched sort ordering.
- `tests/alerts.test.ts` — 26 tests. The original Correction 1 alert-type coverage (availability
  transitions, movie release-date transitions, new-episode-available scoped to Watching-only
  series, 30-item retention) plus the **pass-2 fixes**: `buildReleaseSnapshot` now distinguishes
  "season doesn't exist" from "season exists with no date" and marks a season "available" only
  once it has a released episode; and a new "series season alert change detection" suite covering
  FIRST SYNC / IDENTICAL SNAPSHOT producing zero alerts, NEW SEASON DISCOVERED (even before an
  exact date exists) firing exactly once and not re-firing on a repeated snapshot, RELEASE DATE
  ADDED, RELEASE DATE CHANGED ("delayed" wording with old→new dates), and NEW SEASON AVAILABLE
  firing on a genuine upcoming→available crossing and not re-firing once already available.
- `tests/discover.test.ts` — exclusions (History ∪ Library), subscription-only/selected-service
  eligibility, Similar To media-type scoping, and the Correction 7 personalization suite (5-star-
  genre-match ranks above 3-star-match, History/Library exclusion holds even for high scorers,
  deterministic across repeated calls).
- `tests/season-select.test.ts` — the Correction 10 regression suite: staying on an actively-
  watched season despite a newer unwatched season, falling back to latest-with-unwatched, falling
  back to latest-released, `engagedSeasonNumber` null/non-null cases, `seasonProgress` respecting
  overrides.
- `tests/repo-integration.test.ts` (+ `tests/fake-indexeddb.ts`) — a real integration test against
  `src/lib/repo.ts` + `src/lib/db.ts`, running against a small in-memory IndexedDB polyfill built
  for pass 1 (covers get/getAll/put/putAll/delete/clear per store, single and compound keyPaths —
  the exact subset `db.ts` uses; no cursors/indexes). 11 tests: fixture seeding + idempotency,
  `addToLibrary`/`removeFromLibrary` round-tripping through `getTitleBundle`, the ownership
  boundary (removing library membership leaves ratings intact), rating overwrite-not-duplicate, an
  episode override reflected back through the bundle, `buildExportPayload()` completeness,
  `resetToFixtures()` correctness, and the **pass-2 fixes**: `reconcileAvailability()` removing a
  stale provider-owned row a newer snapshot no longer contains while never touching a user-owned
  store, and `addToLibrary()` rejecting an unknown `titleId` rather than creating a dangling
  Library membership.

### Why the previously-blocked IndexedDB integration test now exists
The external `fake-indexeddb` npm package is not installable in this offline environment (every
`npm install` attempt returns `403 host_not_allowed`). Rather than continuing to document this as
a permanent gap, this session wrote a small, purpose-built in-memory polyfill
(`tests/fake-indexeddb.ts`) covering exactly the narrow IndexedDB surface `db.ts` uses, and used
it to write real integration tests against the actual `repo.ts`/`db.ts` code — not a mock of
`repo.ts` itself. This is a genuine gap-closer, not a workaround that fakes success.

## Browser QA (Correction 16)
```
node server.mjs 8787 &     # or: npm run build && node server.mjs 8787
node browser-qa.mjs
```
`browser-qa.mjs` uses the repository Playwright devDependency and launches Playwright's installed
Chromium by default. `PLAYWRIGHT_CHROMIUM_PATH` may override the executable only when explicitly
supplied. It drives a headless Chromium against synthetic fixture data only.

Result (last run this session, against the rebuilt `dist/`): **19/19 checks passing**, zero
`console.error`/`pageerror` events during the smoke pass. Journeys covered: Home, My Library,
History, Search (typeahead + row results), Discover (cards or empty-state), Settings (Preferences/
Connections tab switch + Sync Now), Alerts, and a full Detail-page pass from a My Library card
(trailer overlay opens and closes, Episodes tab renders rows, Streaming tab renders). A follow-up
manual check confirmed the primary "Open in `<Service>`" action renders correctly for a title with
genuine subscription availability on a selected service (`series-1001` / Nebula Drift → "Open in
Netflix"), and correctly does NOT render for a title with no such availability.

## Responsive QA (Correction 17)
Two representative viewports were used as the closest available proxy for a physical Pixel 9 Pro
Fold in this environment (Playwright viewport emulation; no physical device or Chrome DevTools
device profile was available):
- **Folded (narrow): 344×792** — approximates the fold's outer/cover display.
- **Unfolded (wide): 873×1000** — approximates the fold's inner display.

Checked at both viewports (asserted in `browser-qa.mjs` and confirmed visually via screenshots
taken during this session): no horizontal overflow on Home; My Library's poster grid renders a
sane column count (2 columns folded, 4 columns unfolded) without over-stretching individual poster
cards (measured card width 195px at the unfolded width, well under the over-stretch threshold);
Detail hero/poster header renders correctly at the unfolded width; bottom nav, header, and
streaming-service logos remained legible and correctly laid out at both widths in the screenshot
review. The Home horizontal "Watching Now"/"On Hold" rows show a partial next card when there are
enough items to overflow the row (visible at the folded width in this session's fixture data);
at the unfolded width, the two-item "Watching Now" fixture set simply doesn't fill the row width
— this is a function of the small synthetic fixture set, not a layout defect.

## Touch-target re-verification (final narrow pass)
The independent code review correctly flagged that several controls were still under the ~44×44
CSS px target despite the pass-1 CSS changes. This pass re-measured every listed control with
Playwright against the real rendered DOM (`getBoundingClientRect`/`getComputedStyle`, including
`::before` pseudo-elements where the visible control is intentionally smaller) rather than trusting
the CSS source alone:

| Control | Before | After |
|---|---|---|
| `.segmented button` (Series/Movies) | 40px tall | 44px tall (`min-height` raised) |
| `.toggle` (Settings service switch) | 42×24, no expansion | 44×44 `::before` tap target added |
| `.star` (rating stars) | 32×40, no expansion | 44×44 `::before` tap target added |
| `.action-btn` (action buttons) | ~35px tall, no min-height | 44px tall (`min-height` added) |
| `.pill` (incl. season pills) | 44px tall | unchanged — already correct |
| `.tab-btn` | 44px tall | unchanged — already correct |
| `.icon-btn` | 44×44 | unchanged — already correct |
| `.heart-btn` / `.episode-check` | 44×44 via `::before` | unchanged — already correct |

## Anything that couldn't run, and why
Nothing from either correction list was left untested. The environment-driven adaptations are the
hand-written IndexedDB polyfill (in place of the blocked external `fake-indexeddb` package) and
the temporary lack of a lockfile because this takeover runtime cannot reach npm. The tools are now
pinned as exact repository `devDependencies`; initial CI installs them with `npm install`, and a
registry-enabled follow-up should commit `package-lock.json` and switch CI to `npm ci`.

## Independent takeover validation (v0.10.2)
- `npm run build`: PASS.
- `npm test`: **92/92 PASS**, 22 suites.
- New regression coverage includes bounded season bulk overrides, Home real-watch ordering, Rate Now
  cross-media visibility, provider-known future seasons without episodes, and availability alert repeat cycles.
- `node --check browser-qa.mjs`: PASS after browser-QA updates.
- Playwright browser QA could not be independently executed in the takeover runtime because the package
  is unavailable there; direct Chromium also could not complete due to container/zygote/DBus limitations.
  Therefore the earlier **19/19** browser result is retained only as a prior Claude-run result, not claimed as
  independently reconfirmed.
- No physical Pixel 9 Pro Fold QA has been performed yet.

## GitHub baseline CI preparation (2026-09-06)
- Local `npm run build`: to be re-run after repository-prep edits.
- Local `npm test`: to be re-run after repository-prep edits.
- `browser-qa.mjs` no longer hardcodes Claude's `/opt/pw-browsers/chromium`; it uses Playwright's installed Chromium by default and supports `PLAYWRIGHT_CHROMIUM_PATH` only when explicitly supplied.
- GitHub CI adds separate build/test and Playwright browser/responsive jobs; first remote run is pending PR creation.
