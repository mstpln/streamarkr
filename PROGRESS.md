# Streamarkr — Build Progress

Updated: 2026-09-08.

## Authoritative repository status
- Repository: `mstpln/streamarkr` (public); `main` is the implementation source of truth.
- PR #12 / v0.18.0 same-origin Worker hosting merged at `77d8644e06be5a9e61c0938782616f02cdf8f179`.
- PR #13 secure activation diagnostics merged at `3ddcbfcb515a31e1ed6ce2951ea741832d5adeda` and was separately deployed.
- PR #14 browser-session bootstrap fix merged at `e487b0804f7462aadfcb2ef5264ace141d775d74` and was separately deployed.
- PR #15 cached-client compatibility fix merged at `49c49b322eda3067d96420e147525c0335e44f55` and was separately deployed.
- PR #16 is the active serving-origin activation fix on `fix/same-origin-activation-v0182`.

## Production finding now being fixed
After PR #15 was deployed, production activation still failed at the initial secure-session bootstrap with `Could not create the secure browser session. Local data is unchanged.` No personal state was migrated and IndexedDB remained unchanged.

The repeated token-transport changes did not address a separate structural risk in the same-origin topology: browser origin checks still allowed dashboard/runtime `APP_ORIGIN` configuration to override the actual Worker request origin. Because Streamarkr now serves both the PWA and `/api/*` from the same Worker origin, a stale or mismatched `APP_ORIGIN` can reject a genuinely same-origin browser before token exchange completes.

PR #16 removes that configuration dependency. Browser CORS, session bootstrap/logout, cookie-session verification and authenticated browser route checks now use the actual Worker request URL origin as the authority. `APP_ORIGIN` no longer controls browser origin acceptance. Cross-origin requests still fail closed, operational no-Origin bearer clients remain supported, both current JSON-body and cached-client bearer bootstrap forms remain supported, and session-cookie/token cryptography is unchanged.

A final hardening review found two additional weaknesses before merge: the configured Worker secret itself was not whitespace-normalized even though copied browser input was, and CI did not exercise the real built Worker + static-assets + Chromium authentication topology. Both are now corrected. Surrounding runtime-secret whitespace is normalized consistently for token comparison and session signing/verification, and CI launches the actual Wrangler Worker with the staged same-origin asset bundle, a deliberately stale `APP_ORIGIN`, a padded synthetic runtime secret and real Chromium.

## Review and validation
The earlier PR #16 implementation exposed three tests that still encoded the old configured-origin contract. Those tests were corrected to assert the intended serving-origin behavior rather than weakening the implementation.

The hardening head `c575fabe4e750896af0025c2f9fb45c25b267aae` passed CI #340 / run `34255403504`: build PASS, **208/208 tests**, D1 **5/5**, Wrangler-local D1 PASS, new same-origin Worker auth topology **4/4**, browser/responsive **32/32**, provider/security **8/8**, folded/unfolded PASS and zero console/page errors. The topology test proves the actual Worker accepts same-origin bootstrap despite stale `APP_ORIGIN` and padded runtime-secret whitespace, Chrome retains and reuses the signed HttpOnly cookie, wrong tokens fail with 401, and foreign origins fail with 403.

## Next work
1. Complete the final continuity-synchronized exact-head CI/review cycle for PR #16.
2. Merge only with explicit user authorization.
3. Deploy only with a separate fresh explicit production authorization.
4. Retry secure-storage activation in the live PWA. Accept personal-state migration only after the session verifies and guarded round-trip migration succeeds.
5. Then move on to real TMDB metadata/search, followed by Trakt OAuth/history and Swedish streaming availability/alerts/Discover.

## Remaining V1 limitations
- Secure browser-session activation on the real Workers.dev origin is not yet verified end-to-end.
- No real personal browser state has been migrated to production D1.
- No live TMDB, Trakt or streaming-availability integration yet.
- Streaming-service marks remain placeholders pending properly sourced/licensed assets.
- Physical Pixel 9 Pro Fold QA remains required before V1 release.
