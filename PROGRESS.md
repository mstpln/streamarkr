# Streamarkr — Build Progress

Updated: 2026-09-08.

## Authoritative repository status
- Repository: `mstpln/streamarkr` (public); `main` is the implementation source of truth.
- PR #12 / v0.18.0 same-origin Worker hosting merged at `77d8644e06be5a9e61c0938782616f02cdf8f179`.
- PR #13 secure activation diagnostics merged at `3ddcbfcb515a31e1ed6ce2951ea741832d5adeda` and was separately deployed.
- PR #14 browser-session bootstrap fix merged at `e487b0804f7462aadfcb2ef5264ace141d775d74` and was separately deployed.
- PR #15 is the active compatibility hotfix on `fix/activation-session-v0181`.

## Production finding now being fixed
After PR #14 was deployed, production activation still failed at the initial secure-session bootstrap with `Could not create the secure browser session. Local data is unchanged.` No personal state was migrated and IndexedDB remained unchanged.

PR #15 removes the rollout dependency between the Worker and whichever v0.18 browser bundle is currently installed. `POST /api/auth/session` accepts both the current same-origin JSON-body token exchange and the previous one-time bearer bootstrap used by an older cached client. Both paths still require the exact allowed browser origin, compare the token using the existing constant-time digest logic, never persist or return the device token, and issue the same signed HttpOnly/Secure session cookie.

The compatibility path is limited to the session-bootstrap route. Operational bearer authentication remains supported as before; later browser requests and migration remain cookie-backed.

## Review and validation
The first PR #15 implementation head `c3aef8cfcfa068f87a9ee1d52be57d843f9f0132` passed CI #317 with **208/208 tests**, D1 **5/5**, Wrangler-local PASS, browser/responsive **32/32**, provider/security **8/8**, folded/unfolded PASS and zero console/page errors.

A follow-up review found a regression-coverage gap: the cached-client compatibility test proved the successful bearer path but did not explicitly prove rejection of a wrong bearer token and wrong browser origin on that same POST route. Those negative cases were added at head `7fd7d05796122d7712d95a1521245fed75cbcd78`; full exact-head CI is being rerun before merge readiness.

## Next work
1. Complete PR #15 exact-head CI/review cycle.
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
