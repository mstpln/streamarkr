# Streamarkr build plan

This file is the repository-readable implementation companion to the detailed Streamarkr planning PDF agreed on 5 September 2026. It captures the durable scope and sequencing needed by engineers; `AGENTS.md`, `STREAMARKR_STATE.md`, `STREAMARKR_DECISIONS.md`, and `STREAMARKR_BUILD_STATE.json` remain the authoritative continuity files for current implementation facts.

## Product definition
Streamarkr is a single-user movie and series tracking PWA. It deliberately separates:
- **History**: what Trakt reports as watched. Shared streaming accounts may make this broader than the user's personal interests.
- **My Library**: the user's intentional tracked collection. The heart means Library membership, not liking.
- **Ratings**: one user-owned 1-5 star rating per whole movie or series.
- **Availability**: current provider-owned Swedish streaming availability.
- **Manual corrections**: user-owned watched/unwatched decisions that override provider watch state.

Removing a title from My Library must never delete History, ratings, or manual corrections. Provider refreshes must never overwrite user-owned fields.

## Navigation and core screens
Bottom navigation: **Home · Discover · My Library · History · Settings**. Icons and labels remain visible. Search and Alerts live in the top-right header.

Home is compact and contains, in order:
1. Watching Now / On Hold
2. Rate Now (hidden when empty)
3. New Season

My Library uses separate Series/Movies views, A-Z by default, with Recently Added, Recently Watched, and Highest Rated sorting; filters are Genre, Streaming service, and Status.

History uses Series/Movies tabs, one row per title, A-Z by default or Recently Watched, with Genre and Streaming service filters. Series rows expose watched progress and last watched date when known.

Search covers All / Series / Movies and may open a detail page for any catalogue title. Search heart actions add/remove Library membership without creating dangling title references.

Detail pages exist for every title. Series tabs: Overview / Episodes / Streaming / History. Movie tabs: Overview / Streaming / History. Episodes use horizontally scrollable season pills and vertical episode rows. Primary actions include Library heart, 1-5 stars, trailer, and a genuine streaming deep-link when one exists.

Settings tabs are **Preferences · Connections · Data**, always landing on Preferences. Preferences includes Sweden and the selected streaming-service set. Connections contains Trakt, TMDB, availability, and storage connection state. Data contains import/export/local data controls and version.

## Status rules
User-facing series statuses are:
- **To Watch**: in Library but not started.
- **Watching**: actual viewing activity has started and released unwatched episodes remain.
- **On Hold**: an engaged Watching series has released unwatched episodes and no real watch activity for 14 days.
- **Caught Up**: all released episodes through the user's engaged progression are watched, while the series is not Ended. An entirely untouched newly released season does not itself move a Caught Up title back into Watching.
- **Finished**: all episodes watched and provider series status is Ended.

Manual correction timestamps are provenance only and must not count as viewing activity. Season bulk watched/unwatched actions apply only to currently known released episodes and never become wildcard rules for future episodes.

## Streaming model
Initial selectable services:
- Netflix
- HBO Max
- Disney+
- Prime Video
- SkyShowtime
- Apple TV
- Viaplay
- TV4 Play

Two concepts remain separate:
- **Current availability**: provider-owned, may include multiple services and deep links.
- **Where I watched it**: optional user-owned field stored per movie/series.

Discover only recommends titles included in the subscription tier of one of the user's selected services. Rent/buy-only titles, titles available only on unselected services, History titles, and existing Library titles are excluded.

## Alerts
In-app only; no push notifications. Bell shows unseen count. New rows remain visibly new for the current Alerts visit and are marked seen after leaving. Keep the 30 newest alerts.

Alert types:
- new season discovered / release date added or changed
- new season available
- new episode available, only for series currently Watching
- title becomes available on a selected service
- title leaving a selected service soon
- movie release date announced, changed, delayed, or moved earlier

Alerts must be generated from persisted before/after transitions, never by re-asserting current truth. Availability alert identities must allow legitimate later leave/return cycles on the same service.

## Discover
Views:
- **Based on My Top Picks**: only 5-star titles are the strongest source signal.
- **Similar To**: user may choose any Library title; recommendations stay the same media type.
- **By Genre**: eligible genre matches ranked using the user's rating/preference history.

Cards include poster, title, media type, genre, year, selected-service availability, Why this?, heart, and Watch trailer.

## Visual direction
Primary mode is dark and Pixel 9 Pro Fold first. Use black/charcoal/dark grey surfaces, violet/electric-blue primary accents, pink/coral attention accents, selective neon, depth, subtle glow, soft gradients, restrained glass effects, and dominant poster artwork. Standard poster ratio, generous breathing room, subtle motion, and skeleton loaders.

Home scrolls vertically while content sections scroll horizontally and show a partial next card. My Library and Discover use two poster columns folded and more columns unfolded. Search, History, and Alerts use vertical rows. Important controls target roughly 44x44 CSS px effective touch areas.

## Target architecture
- Installable **Vite + TypeScript** PWA with framework-free UI modules unless a later durable decision changes this.
- Separate **Cloudflare Worker** backend.
- Separate **Cloudflare D1** primary database.
- Optional separate R2 only if object storage becomes useful.
- Provider adapters for **Trakt**, **TMDB**, and **Streaming Availability**.
- GitHub source control and deterministic CI/QA.

The current IndexedDB + fake-provider implementation is a reviewed local stand-in, not the final backend architecture.

## Data ownership
User-owned durable data includes Library membership, ratings, manual overrides, watched-service, selected services, alert seen state, and personal watch/history records required by the app. Provider-owned metadata/availability may be refreshed and reconciled. Stable provider IDs/crosswalks must be preserved so provider records can be updated without replacing user-owned records.

## Refresh strategy
V1 should prefer cached-first rendering, refresh-on-open, and manual Sync Now. Do not introduce unnecessary cron polling. Search results should render metadata before slower availability enrichment when appropriate.

## Security and QA
- Never commit API keys, OAuth secrets, Cloudflare credentials, or personal runtime data.
- Automated QA uses synthetic fixtures only.
- Never call live providers from automated QA.
- Preserve manual overrides and user-owned fields across provider sync.
- Keep app/cache versions synchronized.
- Validate narrow folded and wide unfolded layouts.
- Add focused unit/integration tests for state rules and deterministic browser QA for key journeys.

## Recommended 11-build sequence
1. **Foundation** — repository, Vite/TypeScript PWA shell, version/cache discipline, navigation, synthetic fixtures, CI.
2. **Data model and provider boundaries** — D1 schema, Worker API, stable IDs/crosswalks, ownership rules, fake adapters retained for QA.
3. **TMDB metadata/search** — real search, title/season/episode metadata, artwork/trailer references, caching.
4. **Trakt OAuth/history** — secure Worker-side OAuth/token handling, History ingestion, timestamps, reconciliation.
5. **User state and corrections** — Library, ratings, watched-service, manual overrides, status engine against backend storage.
6. **Library/History/Search/Detail completion** — real backend reads/writes, episode controls, provider-safe caching, deep-link handling.
7. **Home** — Watching Now/On Hold, Rate Now, New Season lifecycle and ordering.
8. **Availability and Alerts** — real Swedish subscription availability, change snapshots, alert engine, 30-item retention.
9. **Discover** — Top Picks, Similar To, By Genre, selected-service eligibility and preference ranking.
10. **Visual/performance hardening** — licensed/approved service logos, Pixel 9 Pro Fold responsive QA, accessibility, offline/update behavior, perceived performance.
11. **V1 release hardening** — full deterministic CI, migrations/backups/export, security review, provider-rate/caching validation, manual device QA and release checklist.

Each build should remain small enough to validate independently. User-visible or architectural builds bump app/cache version exactly once; focused corrections to the same unreleased build keep the same version.
