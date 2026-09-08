# Streamarkr current state

Updated: 2026-09-08. Current app/cache identity remains **v0.18.0 / streamarkr-v0.18.0** while the focused activation fixes stay within the deployed v0.18 line.

## Repository baseline
- Public repo: `mstpln/streamarkr`; `main` is authoritative.
- PR #12 / v0.18.0 same-origin Worker hosting merged at `77d8644e06be5a9e61c0938782616f02cdf8f179`.
- PR #13 secure activation diagnostics merged at `3ddcbfcb515a31e1ed6ce2951ea741832d5adeda`; exact final reviewed head `086a013ac7e9da913f1940b26d839a7a753d6d09` passed the complete validation cycle and was separately authorized for production deployment.
- PR #14 is the active focused browser-session bootstrap fix on `fix/browser-session-bootstrap-v0182`.

## Cloudflare account and production state
Dedicated Streamarkr resources remain separate from BANDMARKR: D1 `streamarkr` in EU, Worker `streamarkr-api`, binding `DB`, runtime secret `DEVICE_ACCESS_TOKEN`, and guarded Workers Builds using only `deploy/production`. The real D1 identifier stays outside the public repository.

The same-origin PWA is live on the existing Streamarkr Workers.dev origin. Manual production validation has confirmed:
- the PWA root renders Streamarkr;
- `/api/health` returns `ok: true`, service `streamarkr-worker`, schema version `1`, and `authConfigured: true`;
- `/api/*` is Worker-routed;
- D1 connectivity is healthy.

## Validated application behavior
- Installable PWA with Home, Discover, My Library, History, Search, Alerts, Settings and universal movie/series detail pages.
- IndexedDB remains the browser cache/offline read layer. D1 becomes durable authority only after guarded migration is imported, round-trip verified and the browser atomically switches `data_source=backend`.
- User-owned Library membership, ratings, manual watch corrections, selected services, watched-service history and alert seen-state retain their ownership boundaries.
- Backend-active mutations are Worker-routed and failed refreshes preserve the last verified offline cache.
- Finished/Caught Up/On Hold and bounded season-override semantics remain unchanged.
- User/provider/service-controlled display text is escaped and provider deep links are HTTP/HTTPS only.

## Production secure-storage activation status
After PR #13 was deployed, a hard-refreshed live retry produced the staged message `Could not create the secure browser session. Local data is unchanged.` This establishes that the failure occurs during the initial token-to-session bootstrap, before browser cookie verification and before D1 migration.

No personal state has been migrated. The local IndexedDB source remains unchanged and authoritative for the current browser until guarded migration succeeds.

## PR #14 — robust one-time browser bootstrap
PR #14 fixes the bootstrap boundary rather than adding another diagnostic-only layer:
- the browser sends the user-entered device token only in the JSON body of same-origin HTTPS `POST /api/auth/session`, not in the browser `Authorization` header;
- the Worker validates that body value with the existing constant-time digest comparison;
- surrounding whitespace introduced by copy/paste is ignored;
- missing/malformed/incorrect token bodies fail closed;
- successful exchange still creates the same signed 30-day `__Host-streamarkr_session` HttpOnly/Secure cookie and never returns or persists the token;
- unexpected session signing errors become the controlled `session_creation_failed` category rather than an uncaught Worker response;
- legacy bearer authentication remains available for non-browser operational clients;
- migration and all later browser requests remain cookie-backed and never re-send the device token.

The service-worker source bytes change so installed v0.18.0 clients detect the hotfix and rerun the existing install-time precache path. This does not clear IndexedDB or modify personal state.

## Validation
PR #14 implementation head `c029d7891add50df815c54036214b078ece1403b` passed CI #309: Cloudflare bundle PASS with 35 compiled modules, **207/207 tests**, D1 **5/5**, Wrangler-local PASS, browser/responsive **32/32**, provider/security **8/8**, folded/unfolded PASS and zero console/page errors.

A final complete exact-head CI/browser cycle is required after continuity synchronization before merge readiness.

## Production safety boundary
- PR #14 does not deploy production.
- The deployment authorization used for PR #13 is consumed.
- Deploying PR #14 after merge requires a fresh explicit user authorization.
- No real personal browser state has been migrated to D1.
- No live TMDB/Trakt/availability credentials or provider calls are part of this fix.
- Automated tests remain synthetic-only and never access production Worker/D1 or BANDMARKR.

## Next sequence toward V1
1. Finish PR #14 exact-head review/test/fix and merge only with explicit approval.
2. Separately authorize and deploy merged PR #14.
3. Hard-refresh once and retry secure-storage activation. If session verification and guarded migration succeed, D1 becomes durable authority and IndexedDB remains the browser cache.
4. Move directly into real TMDB metadata/search.
5. Build Trakt OAuth/history ingestion and reconciliation.
6. Add real Swedish streaming availability, alert transitions and Discover ranking.
7. Finish service branding, performance/accessibility hardening and physical Pixel 9 Pro Fold QA.

## Still pending
- End-to-end secure browser-session activation on the live Workers.dev origin.
- Real personal-state migration to production D1.
- Live provider integrations.
- Properly sourced/licensed streaming-service marks.
- Physical Pixel 9 Pro Fold QA before V1 release.
