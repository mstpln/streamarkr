# Streamarkr — Build Progress

Updated: 2026-09-08.

## Authoritative repository status
- Repository: `mstpln/streamarkr` (public).
- PR #1 established v0.10.2 and merged at `438997dedc282366339e6507d826441d99a81adc`.
- PR #2 established the v0.11.0 Worker + D1 foundation and merged at `65fba889597a22f7703b3337833fc1f0ca3c5cb1`.
- PR #3 established v0.12.0 Wrangler-local D1 validation and merged at `02238c00150b059e9f73cb768e87a62a0d8b25e9`.
- PR #4 established the v0.13.0 guarded Cloudflare activation configuration and merged at `bb1b59427eaa906c5ae3e85a7daba9bdf2601770`.
- PR #6 fixed the Wrangler 4.129.0 remote migration invocation and merged at `73359c56825ea7d9b6bfa1245f513d23c9e08e30`; exact final head `6020bb2c595d14328d3220226e997b3bbaf1471c` passed CI #83.
- PR #7 synchronized verified Cloudflare activation state and merged at `d9dc0cda4cf57f2e9322739241ff65f4d09bbafb`.
- PR #8 established the v0.14.0 backend snapshot cache bridge and merged at `f6e6d4a04aa011e91036a773655e9572e2c6ded6`; exact final head `469235cc3e7ffe0df614b612bc73480cf4fd6da1` passed CI #123.
- PR #9 established the v0.15.0 durable backend user-state mutation surface and merged at `d6e8a9627dd1a1cab2e6d520753084b902589b9d`; exact final head `87dcbf9b3cf77fb8500529d7afbb936c68bf6059` passed CI #215.
- PR #10 established v0.16.0 secure browser authentication/bootstrap and merged at `c26bc20b3579cc3736621e722d623ead12786564`; exact final head `4191f46ee1b1549d2c5079ec1781e302db395476` passed CI #232.
- PR #11 is the active v0.17.0 safe backend-activation migration build. It does not authorize or perform a production deployment.

## Cloudflare account-level setup and activation completed
Dedicated Streamarkr resources are active: D1 `streamarkr` in EU, Worker `streamarkr-api`, binding `DB`, runtime secret `DEVICE_ACCESS_TOKEN`, and guarded Workers Builds using only `deploy/production`. The real D1 identifier remains only in masked Cloudflare configuration.

The first authorized deployment used deployment commit `0c62c574a2680a01ae06dde2c1362e2ec1b5369a` for reviewed main commit `73359c56825ea7d9b6bfa1245f513d23c9e08e30`. Manual verification confirmed healthy Worker/D1 connectivity, schema version 1, eight seeded services and the expected tables. That authorization is consumed; every future production deployment requires fresh explicit authorization.

## Reviewed baseline through v0.16.0
The existing PWA behavior remains the product safety net while infrastructure is migrated. v0.14.0 established guarded atomic Worker-snapshot hydration into IndexedDB, v0.15.0 added the durable user-state Worker/client mutation surface, and v0.16.0 added signed browser-session bootstrap without exposing or persisting the device token.

PR #10 exact final head `4191f46ee1b1549d2c5079ec1781e302db395476` passed CI #232: 176/176 tests, D1 5/5, Wrangler-local PASS, browser/responsive 31/31, provider/security 8/8 and zero console/page errors.

## v0.17.0 safe backend activation migration — PR #11 active
PR #11 combines the remaining closely coupled takeover work into one guarded milestone:
- persisted browser migration UUID before the first network attempt, enabling retry-safe idempotence;
- authenticated/origin-gated `POST /api/migration/local-state`;
- fail-closed pristine-D1 guard rather than implicit merge semantics;
- one-batch D1 import plus migration marker;
- provider-owned sync timestamps/cursors deliberately excluded from durable import;
- authoritative post-import snapshot fetch and durable user-state round-trip verification before browser authority changes;
- atomic IndexedDB switch to verified backend cache only after successful verification;
- repository facade that keeps local behavior before activation and routes user-owned mutations through Worker/D1 after activation;
- authoritative snapshot refresh after backend mutations, while failed refreshes preserve the last verified offline cache;
- cached-first startup for activated installs;
- one-time secure token/session + migration flow in Settings and a reconnect flow for expired/cleared sessions;
- backend-mode fixture reset protection and continued synthetic-sync blocking.

The implementation/review cycle caught and fixed strict Worker typing, stale cache-mode regression expectations, test typing, incomplete migration row validation, provider sync-state promotion, incomplete service-preference verification, expired-session recovery, an outdated browser-QA expectation, a corrupted lockfile integrity entry, and a lost-response retry trap. The retry trap occurred when D1 had committed the first import but the browser never received the response and local state changed before retry; the same migration ID previously returned `alreadyApplied` forever and could leave round-trip verification permanently mismatched. The fix persists a server-side durable-user-state fingerprint, keeps unchanged retries idempotent, safely reconciles changed same-ID retries only while the backend still matches the first imported fingerprint and provider-owned state is untouched, and otherwise fails closed. The lockfile was regenerated from `package.json`, and the normal read-only CI workflow was restored before validation.

Review-fix validation head `eeb744b33db19eb3f98945c2297c11b02258450f`, CI #268:
- `npm ci --no-audit --no-fund`: PASS;
- PWA build: PASS, v0.17.0;
- Worker build/type-check: PASS;
- **198/198 tests across 26 suites**;
- machine-readable build-state JSON/version synchronization: PASS;
- deterministic D1 semantics **5/5**;
- pinned Wrangler **4.129.0** local-D1 validation PASS;
- core browser/responsive QA **32/32**;
- focused provider/security QA **8/8**;
- folded 344×792 PASS and unfolded 873×1000 PASS;
- zero browser console/page errors.

No production Worker/D1, live provider, personal data, or BANDMARKR resource was used by this validation.

## Next work
1. Require the complete normal CI/browser suite to pass on the final unchanged continuity-synchronized PR #11 head.
2. Perform final PR diff, review-thread, secrets/personal-data and security inspection; only then keep PR #11 merge-ready. Merge still requires explicit user authorization.
3. After a reviewed merge, establish the real PWA hosting/API topology, configure exact `APP_ORIGIN`, and validate actual browser cookie behavior. Prefer same-origin/same-site routing.
4. Any production deployment or migration of real browser state requires fresh explicit user authorization and must remain separate from merge authorization.
5. Add real TMDB metadata/search, Trakt OAuth/history and streaming availability in focused reviewed builds.
6. Replace placeholder service badges with properly sourced/licensed assets and complete physical Pixel 9 Pro Fold QA before V1.

## Remaining V1 limitations
- Production browser backend mode is not enabled and `APP_ORIGIN` remains intentionally unset.
- The v0.17 migration/routing path is implemented and synthetically validated, but no real personal browser state has been migrated to production D1.
- Final PWA hosting/API topology and actual cookie behavior are not yet established/validated.
- No live provider integration yet.
- Streaming-service marks remain placeholders pending properly sourced/licensed assets.
- Physical Pixel 9 Pro Fold QA remains required before V1 release.
