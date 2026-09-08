# Streamarkr durable decisions

Updated: 2026-09-08.

## Product/data boundaries
- History is provider ingestion and may contain shared-family viewing; My Library is the user's intentional collection.
- Heart means My Library membership, not liking. Removing from Library preserves History, ratings and manual corrections.
- One 1-5 star rating per whole movie/series; no season or episode ratings.
- Manual watched/unwatched corrections are user-owned and authoritative over provider watch state until changed by the user.
- A manual correction timestamp is provenance, not viewing activity, and must not affect Watching Now recency or the 14-day On Hold timer.
- Provider refreshes may reconcile provider-owned metadata/availability but must never overwrite user-owned state.
- Stable provider IDs/crosswalks are preserved so provider data can change without replacing local identity; user export includes those stable crosswalk IDs.

## Series status semantics
- To Watch: in Library, not started.
- Watching: actual viewing has engaged a season and released unwatched episodes remain.
- On Hold: engaged/Watching, released unwatched episodes remain, and no real watch activity for 14 days.
- Caught Up: all released episodes through the highest engaged season are watched. An entirely untouched newer season does not move a Caught Up series back to Watching/On Hold.
- Finished: all episodes watched and provider series status is exactly `Ended`. `Canceled` does not silently mean Finished.
- `src/lib/season-select.ts` remains the source of truth for engaged/relevant season selection.
- Season bulk watched/unwatched actions are bounded to currently known released episodes. They never create wildcard state for future episodes. Season 0 remains valid for specials.

## Alerts
- Alerts are in-app only; no push notifications in V1.
- Keep newest 30 alerts; no Clear All.
- NEW indicators remain visible throughout the first Alerts visit and are persisted as seen when leaving.
- Alert generation is based on persisted before/after transitions, not repeated assertion of current truth.
- New-episode alerts apply only to series currently Watching.
- Availability alert identities are cycle-aware so a title may legitimately leave and later return on the same service.

## Streaming, filters and Discover
- Initial selectable services: Netflix, HBO Max, Disney+, Prime Video, SkyShowtime, Apple TV, Viaplay, TV4 Play.
- Current availability is provider-owned; historical "where I watched it" is optional user-owned state per title.
- Deselecting a service must not erase or hide historical watched-service values.
- Library's service filter reflects services represented by current availability, not only selected Preferences services.
- Detail's primary streaming action prefers an actionable subscription link on a selected service, then another actionable subscription service. Rent/buy-only offers are not the primary action.
- Discover only includes subscription-included titles on selected services and excludes History and Library titles.
- Top Picks uses 5-star titles; Similar To can use any Library title and stays the same media type; By Genre uses rating/preference weighting.
- Custom service names normalize identically in IndexedDB and Worker/D1 mode, remain bounded to 80 characters, and collision handling must never silently alias different display names.
- Any user/provider/service-controlled text inserted through `innerHTML` is escaped. Provider deep links are restricted to HTTP/HTTPS.

## Architecture
- Target: Vite + TypeScript PWA, Cloudflare Worker, Cloudflare D1, optional R2 only if needed, real provider adapters and GitHub CI.
- PR #11 / v0.17.0 established retry-safe local-state migration/reconciliation plus Worker-routed user-owned mutations after verified takeover.
- PR #12 / v0.18.0 established the **same-origin production topology**: the existing Streamarkr Worker serves PWA static assets and `/api/*` from one Worker origin. It merged at `77d8644e06be5a9e61c0938782616f02cdf8f179` and has been explicitly deployed to the dedicated Streamarkr Worker.
- PR #13 established staged activation diagnostics and explicit post-bootstrap cookie verification. It merged at `3ddcbfcb515a31e1ed6ce2951ea741832d5adeda` and was separately deployed.
- `worker/repository.ts` is the server-side persistence boundary. Worker routes do not contain ad-hoc D1 mutation logic when the operation belongs in the repository layer.
- `src/lib/backend-contract.ts` defines shared browser/Worker shapes; `src/lib/backend-client.ts` is the browser transport seam. UI modules do not call personal Worker routes directly.
- Real provider code implements `worker/provider-contracts.ts`; provider credentials remain Worker-only.
- D1 becomes durable authority only after guarded local-state import, authoritative round-trip verification and atomic browser `data_source=backend` takeover.
- IndexedDB remains the browser cache/offline read layer after activation, not an independent second authority.
- Backend snapshots hydrate IndexedDB atomically; failed Worker fetches or post-mutation refreshes preserve the last verified cache.
- D1/IndexedDB availability identity remains title + service + option type so subscription/rent/buy may coexist.
- Provider refreshes may reconcile provider-owned rows but must not cascade-delete user-owned state.
- User-state identity/scope invariants are enforced at the repository boundary, not only HTTP routing.
- Wrangler is pinned to **4.129.0**; local migration validation uses `--local` and isolated ignored state.

## Local-state migration and backend takeover
- Existing non-empty local/fixture state is never silently overwritten by a first Worker snapshot.
- The browser persists a migration UUID before the first import request; retries reuse it.
- `POST /api/migration/local-state` requires normal authentication and origin protections.
- First import requires pristine durable application state apart from the built-in service registry.
- First import writes accepted state, its durable-user-state fingerprint and migration marker atomically.
- Same-ID unchanged retry is idempotent. Changed same-ID retry may reconcile only while D1 still matches the original durable-user-state fingerprint and provider-owned backend state remains untouched; otherwise it fails closed.
- Provider-owned sync timestamps/cursors are not promoted from local/synthetic state.
- After import, the browser fetches the authoritative snapshot and compares durable user-state categories before switching authority.
- Any import/network/snapshot/verification failure leaves the existing local source intact for recovery.
- Once backend-active, user mutations are Worker-routed and followed by authoritative refresh. No local mutation fallback is allowed.
- Reset-to-fixtures and synthetic provider sync remain prohibited in backend mode.
- Startup is cached-first after activation; Worker outage is non-fatal to the last verified cache.

## Same-origin Worker hosting and browser authentication
- The dedicated production resource remains Worker `streamarkr-api` with D1 `streamarkr` bound as `DB`, always separate from BANDMARKR.
- v0.18 stages only deployable PWA assets under ignored `.wrangler/site`; package files, documentation, tests and private/runtime data are not part of the static asset bundle.
- Generated Wrangler config uses SPA fallback and `run_worker_first: ['/api/*']` so PWA files and API routes share the Worker origin while API routes execute Worker code.
- `npm run build:cloudflare` builds the PWA, type-checks the Worker and stages the static asset bundle. Deployment preflight refuses remote work when required PWA assets are missing.
- `DEVICE_ACCESS_TOKEN` remains the single-user operational secret and is never embedded/persisted in frontend source, generated assets, localStorage, IndexedDB, cookies, logs or repository configuration.
- Browser bootstrap sends the user-entered device token only in the JSON body of same-origin HTTPS `POST /api/auth/session`. It is never placed in the browser `Authorization` header, persisted, logged, returned in a response, or copied into the signed cookie.
- The bootstrap Worker trims surrounding copy/paste whitespace from the supplied browser value, then uses the existing constant-time digest comparison against the configured secret. Missing/malformed/incorrect values fail closed.
- Operational/non-browser clients retain bearer authentication support; the JSON-body rule is specifically the browser bootstrap path.
- Successful bootstrap sets the signed `__Host-streamarkr_session`, `HttpOnly`, `Secure`, `Path=/`, no `Domain`, with current 30-day TTL. Secret rotation invalidates existing sessions.
- Unexpected session-signing failure returns only controlled `session_creation_failed` plus a request ID; raw exception details and credentials are never returned.
- When `APP_ORIGIN` is unset, the effective allowed browser origin is the actual request URL/Worker serving origin. If explicitly configured later, it remains an exact-origin override.
- No-Origin cookie requests are accepted only when the request URL origin equals the effective app origin. Operational bearer clients without browser Origin remain supported.
- `DELETE /api/auth/session` remains origin-gated and clears the session cookie without requiring the device token.
- Browser session state is not stored in D1; signed expiry plus device-secret rotation is the V1 global revocation mechanism.

## Production activation diagnostics
- Live v0.18 validation confirmed the PWA root, `/api/*` routing, schema version 1, D1 health and configured authentication.
- PR #13 staging showed that the remaining live failure occurs at browser bootstrap before cookie verification and migration; no personal state has been migrated.
- No personal state may be considered migrated until the cookie-backed session is verified and the guarded migration/round-trip comparison succeeds.
- Secure-storage activation diagnoses three stages separately: device-token bootstrap, browser-session verification, then migration.
- User-facing diagnostics may expose only safe stage/status categories. They must never surface the device token, arbitrary backend response text, request headers, cookie values or raw exception content.
- After a successful token exchange the browser explicitly verifies `/api/auth/session` before beginning migration.
- Focused production activation fixes may remain within the existing v0.18.0 app/cache identity when they are correcting the same deployed activation boundary rather than introducing a new user-visible or architectural build. The service-worker source bytes must still change so installed clients rerun the install/precache path. The normal rule remains that new user-visible/architectural builds advance package, Settings and cache versions together.

## Cloudflare activation and deployment
- The committed `wrangler.jsonc` remains account-neutral. Account-specific D1 binding data is generated under ignored `.wrangler/deploy/` state from build-only configuration.
- The real D1 UUID stays outside the public repository and must never be printed by deployment helpers.
- Remote migration/deployment disables automatic provisioning and draft-resource creation.
- `DEVICE_ACCESS_TOKEN` is a required Worker secret; production deployment fails if it is absent.
- Wrangler preserves dashboard-managed runtime variables/secrets rather than removing them as a side effect.
- Normal merges to `main` never automatically deploy production. `deploy/production` remains the only guarded production trigger after fresh explicit user authorization.
- Each deployment authorization is consumed by the exact deployment it authorizes and cannot be reused for later heads.
- The deployment authorization used for PR #13 is consumed. PR #14 or any later head requires a new explicit deployment authorization after merge.

## Repository/security
- Repository is public: `mstpln/streamarkr`.
- Only source, documentation and synthetic fixtures may be committed.
- Never commit API keys, OAuth secrets/tokens, Cloudflare credentials, usable private D1 identifiers, `.env`/`.dev.vars`, or personal History/Library/ratings/runtime data.
- Real secrets belong in appropriate GitHub/Cloudflare secret stores/environment bindings.
- Automated QA is synthetic-only and never calls live providers or production data.
- Streamarkr resources remain completely separate from BANDMARKR; never inspect, bind, reuse, migrate or modify BANDMARKR Worker/D1/R2/secrets/data.

## UI/QA
- Primary visual mode is dark, premium and poster-led with violet/electric-blue and pink/coral accents.
- Pixel 9 Pro Fold is the primary device target; both folded and unfolded widths must be validated.
- Important controls target ~44x44 CSS px effective touch areas and icon-only actions require accessible labels/focus behavior.
- Streaming-service badges remain placeholders until properly sourced/licensed assets are added.
- App/runtime version and service-worker cache version normally stay synchronized; one user-visible/architectural build gets one version bump.
- Settings token entry remains password-only, not prefilled and cleared after use.

## Test/tooling decision
- Domain/Worker tests compile with TypeScript then use Node `node:test`; browser QA uses Playwright.
- TypeScript, Playwright and Wrangler **4.129.0** are pinned and `package-lock.json` is committed.
- GitHub CI uses Node 22 and `npm ci`.
- D1 migration is exercised against Node 22 SQLite and pinned Wrangler local D1.
- Deployment-config tests use only synthetic D1 UUIDs and never contact Cloudflare.
- Physical Pixel 9 Pro Fold QA remains a separate pre-V1 requirement.
