# Streamarkr — Build Progress

Updated: 2026-09-08.

## Authoritative repository status
- Repository: `mstpln/streamarkr` (public); `main` is the implementation source of truth.
- v0.10.2 through v0.17.0 are merged through PRs #1-#11.
- PR #12 / v0.18.0 same-origin Worker hosting merged at `77d8644e06be5a9e61c0938782616f02cdf8f179`; exact final PR head `c24795f93e9887620d3bdfacb438422c6e86c56a` passed the complete review/test cycle.
- PR #13 is the focused production-activation diagnostic hotfix on `fix/backend-activation-diagnostics-v0181`. It does not itself authorize or perform a production deployment.

## Cloudflare production state
Dedicated Streamarkr resources remain completely separate from BANDMARKR: Worker `streamarkr-api`, EU D1 `streamarkr`, binding `DB`, and runtime secret `DEVICE_ACCESS_TOKEN`. The real D1 identifier remains outside the public repository.

The user explicitly authorized the v0.18.0 production deployment. Guarded branch `deploy/production` was advanced to reviewed main `77d8644e06be5a9e61c0938782616f02cdf8f179`. The live PWA is now served from the existing Streamarkr Workers.dev origin.

Manual production validation confirmed:
- the Streamarkr PWA loads from the live Worker origin;
- `/api/health` returns `ok: true`, service `streamarkr-worker`, schema version `1`, and `authConfigured: true`;
- `/api/*` is routed to Worker code rather than SPA fallback;
- D1 connectivity is healthy.

The first secure-storage activation attempt did **not** complete. Settings showed the old generic connection/migration failure, and a same-browser follow-up GET to `/api/auth/session` returned `unauthorized`. No real personal browser state was migrated and the local IndexedDB source remains unchanged.

## PR #13 — secure activation diagnostics
The hotfix makes the next production retry diagnostic without exposing credentials:
- backend failures retain only HTTP status plus a sanitized backend error code;
- Settings separates device-token bootstrap, cookie-backed session verification, and local-state migration into explicit stages;
- after token exchange, Settings verifies `/api/auth/session` before attempting migration;
- token rejection, browser-session retention failure, origin rejection, migration conflict, and invalid migration payload produce distinct safe messages;
- arbitrary underlying error text is never rendered to the user;
- token input remains password-only, is cleared after use, and is never persisted.

The service-worker script is changed so an installed v0.18.0 client detects the hotfix and refreshes its precached module graph. App/cache identifiers remain v0.18.0 because this is a same-build production diagnostic hotfix rather than a new product build; no schema or contract version changes are introduced.

## Validation
PR #12 final validation: Cloudflare bundle PASS, 200/200 tests, D1 5/5, Wrangler-local PASS, browser/responsive 32/32, provider/security 8/8, folded/unfolded PASS, zero console/page errors.

PR #13 adds deterministic regression coverage for structured backend errors, staged activation diagnostics, and non-disclosure of arbitrary/token-bearing error text. Every final PR head must pass the complete normal verify + browser QA workflow before merge readiness.

## Next work
1. Finish the PR #13 exact-head review/test/fix cycle and merge only with explicit user authorization.
2. A separate fresh explicit production-deployment authorization is required before deploying PR #13 after merge.
3. Retry secure storage activation in the live browser and use the staged message to identify the actual blocker. Do not migrate real personal state unless session verification and migration complete cleanly.
4. Once backend activation is verified, move directly into real TMDB metadata/search, followed by Trakt OAuth/history and then Swedish streaming availability/alerts/Discover.
5. Complete licensed service marks, performance/accessibility hardening and physical Pixel 9 Pro Fold QA before V1.

## Remaining V1 limitations
- Secure browser-session activation on the real Workers.dev origin is not yet verified end-to-end.
- No real personal browser state has been migrated to production D1.
- No live TMDB, Trakt or streaming-availability integration yet.
- Streaming-service marks remain placeholders pending properly sourced/licensed assets.
- Physical Pixel 9 Pro Fold QA remains required before V1 release.
