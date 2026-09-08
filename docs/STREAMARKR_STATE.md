# Streamarkr current state

Updated: 2026-09-08. Current app/cache identity remains **v0.18.0 / streamarkr-v0.18.0** while the focused activation fixes stay within the deployed v0.18 line.

## Repository baseline
- Public repo: `mstpln/streamarkr`; `main` is authoritative.
- PR #12 / v0.18.0 same-origin Worker hosting merged at `77d8644e06be5a9e61c0938782616f02cdf8f179`.
- PR #13 secure activation diagnostics merged at `3ddcbfcb515a31e1ed6ce2951ea741832d5adeda` and was separately deployed.
- PR #14 browser-session bootstrap fix merged at `e487b0804f7462aadfcb2ef5264ace141d775d74` and was separately deployed.
- PR #15 is the active focused cached-client compatibility fix on `fix/activation-session-v0181`.

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
After PR #14 was deployed, the live browser still produced `Could not create the secure browser session. Local data is unchanged.` The failure remains at the initial token-to-session bootstrap, before browser cookie verification and before D1 migration.

No personal state has been migrated. The local IndexedDB source remains unchanged and authoritative for the current browser until guarded migration succeeds.

## PR #15 — cached-client bootstrap compatibility
PR #15 removes the rollout dependency between the Worker and the installed v0.18 browser bundle:
- the current browser flow may continue sending the one-time device token in the JSON body of same-origin HTTPS `POST /api/auth/session`;
- an older cached browser bundle that still sends that one-time token as `Authorization: Bearer ...` is also accepted on the same POST route;
- both forms require the exact allowed browser origin before credential validation;
- both forms use the existing constant-time digest comparison;
- successful exchange creates the same signed 30-day `__Host-streamarkr_session` HttpOnly/Secure cookie;
- the device token is never returned, copied into the cookie, or persisted;
- the compatibility allowance is limited to bootstrap; migration and later browser requests remain cookie-backed.

Review added explicit negative regressions proving that the compatibility path rejects both a wrong bearer token and a correct bearer token from the wrong browser origin.

## Validation
Initial PR #15 head `c3aef8cfcfa068f87a9ee1d52be57d843f9f0132` passed CI #317: Cloudflare bundle PASS with 35 compiled modules, **208/208 tests**, D1 **5/5**, Wrangler-local PASS, browser/responsive **32/32**, provider/security **8/8**, folded/unfolded PASS and zero console/page errors.

The reviewed regression-hardening head `7fd7d05796122d7712d95a1521245fed75cbcd78` passed the verify job; full exact-final-head CI/browser validation is required again after continuity synchronization before merge readiness.

## Production safety boundary
- PR #15 does not deploy production.
- Previous deployment authorization is consumed.
- Deploying PR #15 after merge requires a fresh explicit user authorization.
- No real personal browser state has been migrated to D1.
- No live TMDB/Trakt/availability credentials or provider calls are part of this fix.
- Automated tests remain synthetic-only and never access production Worker/D1 or BANDMARKR.

## Next sequence toward V1
1. Finish PR #15 exact-head review/test/fix and merge only with explicit approval.
2. Separately authorize and deploy merged PR #15.
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
