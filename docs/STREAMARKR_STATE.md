# Streamarkr current state

Updated: 2026-09-08. Current build: **v0.17.0** / service-worker cache **streamarkr-v0.17.0**.

## Repository baseline
- Public repo: `mstpln/streamarkr`.
- PR #1 merged at `438997dedc282366339e6507d826441d99a81adc` and established the reviewed v0.10.2 synthetic/local baseline.
- PR #2 merged at `65fba889597a22f7703b3337833fc1f0ca3c5cb1` and established the reviewed v0.11.0 Worker + D1 source foundation.
- PR #3 merged at `02238c00150b059e9f73cb768e87a62a0d8b25e9` and established the reviewed v0.12.0 Wrangler-local D1 validation layer.
- PR #4 merged at `bb1b59427eaa906c5ae3e85a7daba9bdf2601770` and established the reviewed v0.13.0 guarded Cloudflare activation configuration.
- PR #6 merged at `73359c56825ea7d9b6bfa1245f513d23c9e08e30` and fixed the Wrangler 4.129.0 remote migration invocation.
- PR #7 merged at `d9dc0cda4cf57f2e9322739241ff65f4d09bbafb` and synchronized verified Cloudflare activation state.
- PR #8 merged at `f6e6d4a04aa011e91036a773655e9572e2c6ded6` and established the reviewed v0.14.0 backend snapshot cache bridge. Exact final head `469235cc3e7ffe0df614b612bc73480cf4fd6da1` passed CI #123.
- PR #9 merged at `d6e8a9627dd1a1cab2e6d520753084b902589b9d` and established the reviewed v0.15.0 durable backend user-state mutation surface. Exact final head `87dcbf9b3cf77fb8500529d7afbb936c68bf6059` passed CI #215.
- PR #10 merged at `c26bc20b3579cc3736621e722d623ead12786564` and established the reviewed v0.16.0 secure browser-auth bootstrap. Exact final PR head `4191f46ee1b1549d2c5079ec1781e302db395476` passed CI #232.
- PR #11 is the active v0.17.0 safe backend-activation migration build. It adds retry-safe local-state migration/reconciliation and Worker-routed browser mutations, but does **not** configure production `APP_ORIGIN`, deploy production, or migrate real personal data.

## Cloudflare account state
Dedicated Streamarkr resources are active: D1 `streamarkr` with EU jurisdiction, Worker `streamarkr-api`, Worker binding `DB`, runtime secret `DEVICE_ACCESS_TOKEN`, and guarded Workers Builds using `deploy/production`. The real D1 identifier remains outside the public repository.

With explicit user authorization, deployment branch commit `0c62c574a2680a01ae06dde2c1362e2ec1b5369a` deployed reviewed main commit `73359c56825ea7d9b6bfa1245f513d23c9e08e30`. Manual verification confirmed healthy Worker/D1 connectivity, schema version 1, eight seeded services and the expected tables. No personal viewing data, live-provider credentials/calls, or BANDMARKR resources were used. `APP_ORIGIN` remains intentionally unset. The prior deployment authorization is consumed; every future production deployment requires fresh explicit user authorization.

## Validated PWA behavior preserved
- Installable PWA with Home, Discover, My Library, History, Search, Alerts, Settings, and universal movie/series detail pages.
- IndexedDB remains the browser cache/offline read layer; D1 becomes the durable authority only after the guarded migration flow has completed successfully.
- User-owned Library membership, 1-5 star ratings, manual watched/unwatched overrides, selected streaming services, historical watched-service, and alert seen state retain their established ownership boundaries.
- Finished requires provider series status `Ended`; untouched newer seasons do not break Caught Up; On Hold uses real provider watch timestamps only.
- Season bulk corrections affect only currently known/released episodes, never future episodes.
- User/provider/service-controlled `innerHTML` display text is escaped on all current screens, custom-service brand lookup rejects prototype-like inherited keys, and provider deep links are restricted to HTTP/HTTPS.
- Home, Library, History, Search, Discover, Detail, Alerts and Settings behaviors remain covered by deterministic browser QA.
- Streaming-service marks remain placeholders pending licensed assets; Pixel 9 Pro Fold remains the primary physical-device target.

## v0.14.0 backend cache bridge — merged
- IndexedDB schema v2 aligns availability identity with D1.
- Backend snapshots hydrate the related browser cache atomically.
- Initial backend takeover is blocked for non-empty fixture/local/legacy caches until an explicit migration/reset exists.
- Backend-hydrated caches survive offline fixture seeding; failed Worker refresh leaves prior cache intact.
- Local-only user mutations and synthetic provider sync are blocked while backend-cache mode is active.
- Exact final PR #8 head `469235cc3e7ffe0df614b612bc73480cf4fd6da1` passed CI #123: 137/137 tests, D1 5/5, Wrangler-local PASS, browser QA 27/27 and zero smoke-pass console errors.

## v0.15.0 durable user-state mutation surface — merged
- `WorkerBackendClient` exposes watched-service set/clear, movie/episode/season watched-state corrections, service selection and custom-service creation in addition to snapshot/Library/rating/alert operations.
- Watched-service mutations require a canonical title and a known currently selected service.
- Movie overrides require canonical movies; episode/season overrides require canonical series, and episode/season existence is validated before correction.
- Season bulk corrections are computed server-side from episodes already known and released at action time, remove any legacy season wildcard, and materialize only episode-level overrides in one D1 batch. Season 0 remains valid for specials.
- Local IndexedDB custom-service behavior matches Worker/D1 normalization and 80-character route bounds; same-name additions reselect and different-name normalized-key collisions are rejected.
- Exact final PR #9 head `87dcbf9b3cf77fb8500529d7afbb936c68bf6059` passed CI #215 after continuity synchronization. The implementation-validation head `d683104382bc7337bf0457ab0bb179e64ca3a64c` passed CI #211 with 164/164 tests, D1 5/5, Wrangler-local PASS, core browser/responsive QA 31/31, provider/security browser QA 8/8 and zero console/page errors.

## v0.16.0 secure browser authentication/bootstrap — merged
- `DEVICE_ACCESS_TOKEN` remains a Worker-side secret and is **not embedded or persisted in public frontend source, generated assets, localStorage, IndexedDB, or cookies**.
- A user-supplied device token can be presented only to `POST /api/auth/session` and exchanged for a signed, expiring browser session.
- Browser sessions are HMAC-SHA256 signed with explicit context, include an expiry and random nonce, and are carried in a `__Host-streamarkr_session` cookie with `HttpOnly`, `Secure`, `Path=/`, and `SameSite=None`.
- Session TTL is 30 days. Tampering or expiry invalidates the session; rotating `DEVICE_ACCESS_TOKEN` invalidates previously signed sessions immediately.
- `GET /api/auth/session` reports the active authentication method. `DELETE /api/auth/session` clears the browser cookie without requiring the device token.
- Credentialed browser CORS is allowed only for exact configured `APP_ORIGIN`. Operational bearer clients with no browser Origin remain supported for controlled manual verification.
- Exact final PR #10 head `4191f46ee1b1549d2c5079ec1781e302db395476` passed CI #232 with 176/176 tests, D1 5/5, Wrangler-local PASS, browser/responsive QA 31/31, provider/security QA 8/8 and zero console/page errors.

## v0.17.0 safe backend activation migration — PR #11 active
- A browser-side migration UUID is persisted in IndexedDB before the first network attempt, making a lost response safely retryable with the same migration identity.
- `POST /api/migration/local-state` is authenticated and origin-gated. The Worker rejects malformed payloads and refuses first takeover when D1 already contains non-registry state rather than guessing merge semantics.
- Imported local state, its durable-user-state fingerprint and the migration marker are written atomically. An unchanged same-ID retry is idempotent. If the first response was lost and local state changed before retry, the same ID may reconcile only while current D1 durable user state still matches the original fingerprint and provider-owned backend state remains untouched; otherwise the Worker fails closed. A different prior migration ID is always a conflict.
- Provider-owned sync timestamps/cursors are deliberately **not** promoted from browser/synthetic cache into durable D1.
- After import, the browser fetches an authoritative D1 snapshot and compares durable user-state categories before changing the local authority marker. A mismatch or failed request leaves the existing IndexedDB source untouched for recovery.
- Once migration succeeds, IndexedDB is atomically replaced with the verified Worker/D1 snapshot and marked `data_source=backend`.
- The repository facade preserves local behavior before activation. After activation, Library, ratings, watched-service, watch overrides, service preferences/custom services and alert-seen mutations route through `WorkerBackendClient`, then refresh the authoritative snapshot.
- Failed post-mutation refreshes never clear the last verified offline cache. Backend mode cannot be reset to demo fixtures, and synthetic provider sync remains disabled.
- Startup remains cached-first: an activated installation renders from IndexedDB while offline and opportunistically refreshes when the authenticated Worker is reachable.
- Settings now exposes one-time token exchange + migration for inactive installs and secure-session reconnect/refresh for activated installs. Token fields are password-only, not prefilled, and cleared after use.
- Production activation is still intentionally blocked: `APP_ORIGIN` is unset, final PWA hosting/API topology is not established, and no production deployment or personal-data migration has been authorized.
- Review-fix validation head `eeb744b33db19eb3f98945c2297c11b02258450f`, CI #268: `npm ci` PASS, PWA build PASS, Worker type-check PASS, **198/198 tests across 26 suites**, machine-readable build-state/version validation PASS, D1 **5/5**, Wrangler-local PASS, core browser/responsive QA **32/32**, provider/security QA **8/8**, folded/unfolded PASS and zero console/page errors.

## Still pending
- Run the complete normal CI/browser suite on the final unchanged continuity-synchronized PR #11 head and complete final diff/security/review-thread inspection before merge readiness.
- Establish the real PWA hosting origin and same-origin/same-site API path where possible; configure exact production `APP_ORIGIN` and validate actual cookie behavior before browser activation.
- Perform any future production deployment and real local-state migration only after fresh explicit user authorization and a reviewed merged source head.
- Add real TMDB search/metadata, Trakt OAuth/history, and streaming-availability adapters in focused reviewed builds.
- Replace placeholder service badges with properly sourced/licensed logos.
- Run physical Pixel 9 Pro Fold QA before V1 release.
