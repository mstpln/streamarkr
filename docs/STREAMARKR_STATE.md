# Streamarkr current state

Updated: 2026-09-08. Current app/cache identity remains **v0.18.0 / streamarkr-v0.18.0** while the focused activation fixes stay within the deployed v0.18 line.

## Repository baseline
- Public repo: `mstpln/streamarkr`; `main` is authoritative.
- PR #12 / v0.18.0 same-origin Worker hosting merged at `77d8644e06be5a9e61c0938782616f02cdf8f179`.
- PR #13 secure activation diagnostics merged at `3ddcbfcb515a31e1ed6ce2951ea741832d5adeda` and was separately deployed.
- PR #14 browser-session bootstrap fix merged at `e487b0804f7462aadfcb2ef5264ace141d775d74` and was separately deployed.
- PR #15 cached-client bootstrap compatibility fix merged at `49c49b322eda3067d96420e147525c0335e44f55` and was separately deployed.
- PR #16 is the active focused serving-origin activation fix on `fix/same-origin-activation-v0182`.

## Cloudflare account and production state
Dedicated Streamarkr resources remain separate from BANDMARKR: D1 `streamarkr` in EU, Worker `streamarkr-api`, binding `DB`, runtime secret `DEVICE_ACCESS_TOKEN`, and guarded Workers Builds using only `deploy/production`. The real D1 identifier stays outside the public repository.

The same-origin PWA is live on the existing Streamarkr Workers.dev origin. Manual production validation has confirmed the PWA root, `/api/*` Worker routing, D1 schema version 1 and configured authentication.

## Validated application behavior
- Installable PWA with Home, Discover, My Library, History, Search, Alerts, Settings and universal movie/series detail pages.
- IndexedDB remains the browser cache/offline read layer. D1 becomes durable authority only after guarded migration is imported, round-trip verified and the browser atomically switches `data_source=backend`.
- User-owned Library membership, ratings, manual watch corrections, selected services, watched-service history and alert seen-state retain their ownership boundaries.
- Backend-active mutations are Worker-routed and failed refreshes preserve the last verified offline cache.
- Finished/Caught Up/On Hold and bounded season-override semantics remain unchanged.

## Production secure-storage activation status
After PR #15 was deployed, the live browser still produced `Could not create the secure browser session. Local data is unchanged.` The failure remains before cookie verification and before D1 migration. No personal state has been migrated; local IndexedDB remains authoritative until guarded migration succeeds.

## PR #16 — serving-origin activation plus final hardening
The same Worker serves both Streamarkr's PWA and `/api/*`. PR #16 therefore makes the actual request URL origin the browser-origin authority instead of allowing `APP_ORIGIN` configuration to override it.

The change covers browser CORS, session bootstrap/logout, cookie-session verification and authenticated browser-origin checks. A stale or mismatched `APP_ORIGIN` can no longer reject a genuinely same-origin Streamarkr browser. Cross-origin requests remain rejected. Current JSON-body bootstrap and cached-client bearer bootstrap remain supported; operational bearer clients without a browser Origin remain supported.

A final review found one additional authentication edge: browser-entered token whitespace was normalized, but the configured Worker secret itself was not. PR #16 now normalizes surrounding whitespace on both sides before constant-time token comparison and uses the same normalized secret for session HMAC creation/verification. This protects against accidental newline/space padding in the runtime secret without changing interior token content or storing the token.

The same review also found that existing browser QA used `server.mjs` and therefore did not test Worker static hosting, Worker-first `/api/*` routing and real browser cookie reuse together. CI now runs a dedicated `qa:worker-auth` topology test against pinned Wrangler and real Chromium before the normal synthetic UI QA.

## Validation
The earlier PR #16 implementation exposed three tests that still encoded the superseded configured-origin contract. They were corrected to the serving-origin contract rather than weakening the Worker.

Hardening head `c575fabe4e750896af0025c2f9fb45c25b267aae` passed CI #340 / run `34255403504`: **208/208** logic/Worker/client tests, D1 **5/5**, Wrangler-local D1 PASS, same-origin Worker auth topology **4/4**, browser/responsive **32/32**, provider/security **8/8**, folded/unfolded PASS and zero console/page errors. The topology pass specifically proved stale `APP_ORIGIN` does not block the real serving origin, padded synthetic runtime-secret whitespace is tolerated consistently, Chromium retains/reuses the issued HttpOnly/Secure cookie, wrong tokens fail 401 and foreign origins fail 403.

A final exact-head CI/browser cycle is required after continuity synchronization before merge readiness.

## Production safety boundary
- PR #16 does not deploy production.
- The deployment authorization used for PR #15 is consumed.
- Deploying PR #16 after merge requires fresh explicit user authorization.
- No real personal browser state has been migrated to D1.
- No live TMDB/Trakt/availability credentials or provider calls are part of this fix.
- Automated tests remain synthetic-only and never access production Worker/D1 or BANDMARKR.

## Next sequence toward V1
1. Finish PR #16 exact-head review/test/fix cycle and merge only with explicit approval.
2. Separately authorize and deploy merged PR #16.
3. Retry secure-storage activation. If session verification and guarded migration succeed, D1 becomes durable authority and IndexedDB remains the browser cache.
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
