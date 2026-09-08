# Streamarkr current state

Updated: 2026-09-08. Current PR build: **v0.18.1** / service-worker cache **streamarkr-v0.18.1**. Production remains on deployed **v0.18.0** until PR #13 is merged and separately authorized for deployment.

## Repository baseline
- Public repo: `mstpln/streamarkr`; `main` is authoritative.
- PR #11 / v0.17.0 safe backend activation migration merged at `1e411d1696d32269327b5ef30de5c5f158f302e0`.
- PR #12 / v0.18.0 same-origin Worker hosting merged at `77d8644e06be5a9e61c0938782616f02cdf8f179`; exact final PR head `c24795f93e9887620d3bdfacb438422c6e86c56a` passed Cloudflare bundle build, 200/200 tests, D1 5/5, Wrangler-local validation, browser/responsive 32/32, provider/security 8/8 and zero console/page errors.
- PR #13 is the active **v0.18.1 production-activation diagnostics** patch on `fix/backend-activation-diagnostics-v0181`.

## Cloudflare account and production state
Dedicated Streamarkr resources remain separate from BANDMARKR: D1 `streamarkr` in EU, Worker `streamarkr-api`, binding `DB`, runtime secret `DEVICE_ACCESS_TOKEN`, and guarded Workers Builds using only `deploy/production`. The real D1 identifier stays outside the public repository.

The user explicitly authorized deployment of reviewed v0.18.0 main. `deploy/production` was advanced to `77d8644e06be5a9e61c0938782616f02cdf8f179` and the same-origin PWA is live on the existing Streamarkr Workers.dev origin.

Manual production validation confirmed:
- the PWA root renders Streamarkr;
- `/api/health` is Worker-routed and returns `ok: true`, service `streamarkr-worker`, schema version `1`, and `authConfigured: true`;
- the dedicated Streamarkr D1 connection is healthy;
- static assets and `/api/*` share the intended Worker origin.

## Validated application behavior
- Installable PWA with Home, Discover, My Library, History, Search, Alerts, Settings and universal movie/series detail pages.
- IndexedDB remains the browser cache/offline read layer. D1 becomes durable authority only after guarded migration is imported, round-trip verified and the browser atomically switches `data_source=backend`.
- User-owned Library membership, ratings, manual watch corrections, selected services, watched-service history and alert seen-state retain their ownership boundaries.
- Backend-active mutations are Worker-routed and failed refreshes preserve the last verified offline cache.
- Finished/Caught Up/On Hold and bounded season-override semantics remain unchanged.
- User/provider/service-controlled display text is escaped and provider deep links are HTTP/HTTPS only.

## Production secure-storage activation status
The first real-browser secure-storage activation attempt did not complete. The deployed v0.18.0 Settings UI reported its generic `Connection or migration failed` message. A same-browser follow-up request to `/api/auth/session` returned `unauthorized`.

That observation does **not** prove whether the device token was rejected during bootstrap or a successfully issued cookie was not retained, because v0.18.0 combined bootstrap and migration failures. No personal state was migrated and the local IndexedDB source remains unchanged.

## PR #13 / v0.18.1 activation diagnostics
PR #13 makes the activation boundary safely observable:
- `BackendRequestError` preserves only HTTP status plus a strictly sanitized backend error code;
- Settings treats token bootstrap, browser-session verification, and migration as separate stages;
- after bootstrap it explicitly verifies the cookie-backed session before any migration;
- token rejection, origin rejection, cookie-retention failure, migration conflict, and invalid migration payload receive distinct safe messages;
- arbitrary backend/exception text is never rendered, preventing accidental secret/error-detail disclosure;
- the token remains password-only, is cleared after use and is never persisted.

Because the compiled browser module graph changed, the normal cache/version rule is followed: package version, Settings version and service-worker cache all advance together to **v0.18.1 / streamarkr-v0.18.1**.

## Production safety boundary
- PR #13 does not deploy production.
- The prior v0.18.0 deployment authorization is consumed; deploying v0.18.1 requires fresh explicit user authorization after merge.
- No real personal browser state has been migrated to D1.
- No live TMDB/Trakt/availability credentials or provider calls are part of this work.
- Automated tests remain synthetic-only and never access production Worker/D1 or BANDMARKR.

## Next sequence toward V1
1. Finish PR #13 exact-head review/test/fix and merge only with explicit approval.
2. Separately authorize and deploy merged v0.18.1 if the user chooses to do so.
3. Retry secure-storage activation and resolve the exact staged failure, if any, before accepting real personal-state migration.
4. Build real TMDB metadata/search.
5. Build Trakt OAuth/history ingestion and reconciliation.
6. Add real Swedish streaming availability, alert transitions and Discover ranking.
7. Finish service branding, performance/accessibility hardening and physical Pixel 9 Pro Fold QA.

## Still pending
- End-to-end secure browser-session activation on the live Workers.dev origin.
- Real personal-state migration to production D1.
- Live provider integrations.
- Properly sourced/licensed streaming-service marks.
- Physical Pixel 9 Pro Fold QA before V1 release.
