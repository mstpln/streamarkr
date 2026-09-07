# Streamarkr — Tests

## Authoritative baseline validation

The current v0.10.2 baseline is validated in GitHub Actions on Node 22 using the committed `package-lock.json` and reproducible `npm ci` installation.

### Build
```bash
npm ci
npm run build
```
Current result: **PASS**, generating a service-worker manifest covering **29 compiled modules**.

### Logic / repository tests
```bash
npm test
```
Current result: **101/101 PASS**, **26 suites**, 0 failures, 0 skipped, 0 todo.

Coverage includes:
- series status semantics: To Watch / Watching / On Hold / Caught Up / Finished
- Ended-only Finished rule for series
- real-watch timestamp ordering and On Hold timing
- untouched-new-season Caught Up behavior and older-season gaps
- bounded season bulk watched/unwatched corrections
- provider/manual watch-state precedence and unknown manual watch dates
- History aggregation and recently-watched ordering
- alert transition detection, repeat availability cycles, release-date changes, 30-item retention
- provider-owned availability reconciliation without touching user-owned stores
- future New Season records before episode records exist
- Library integrity against dangling title IDs
- user-data export completeness and stable provider crosswalk preservation
- Discover eligibility/ranking/exclusions
- primary streaming-action selected-service preference with unselected-service fallback
- historical/current service filter behavior when Preferences selection changes
- Home Rate Now and Watching Now read models

### Browser / responsive QA
```bash
npm run build
npm run serve
npm run qa:browser
```
Current GitHub result: **27/27 PASS** in Playwright Chromium.

The deterministic synthetic-only journey covers:
- Home, My Library, History, Search, Discover, Settings, Alerts, and Detail
- Discover heart add/removal from recommendation results
- Settings re-entry to Preferences
- Alerts NEW indicator lifecycle: visible during first visit, marked seen on page exit, absent next visit
- semantic rating controls
- Detail progress/release context, trailer overlay, episode list/synopsis, separated manual corrections, Streaming tab
- zero `console.error` / `pageerror` events in the smoke journey
- folded proxy **344×792** with no Home horizontal overflow and sane Library grid
- unfolded proxy **873×1000** with no Home horizontal overflow, non-stretched poster cards, and Detail hero rendering

## Data-safety rules for testing
- Synthetic fixtures only.
- No live Trakt/TMDB/Streaming Availability calls.
- No real API keys, OAuth tokens, Cloudflare credentials, or personal viewing data.
- Future provider-integration tests must use synthetic/sandboxed accounts or recorded fixtures, never production credentials/data.

## Manual limitation
A physical **Pixel 9 Pro Fold** has not yet been tested. Browser viewport QA covers representative folded/unfolded dimensions, but physical-device validation remains required before V1 release.
