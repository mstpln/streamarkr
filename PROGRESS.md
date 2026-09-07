# Streamarkr — Build Progress

Updated: 2026-09-07.

## Authoritative repository status
- Repository: `mstpln/streamarkr` (public).
- PR #1 established the reviewed v0.10.2 synthetic/local baseline and merged at `438997dedc282366339e6507d826441d99a81adc`.
- PR #2 established the reviewed v0.11.0 Worker + D1 source foundation and merged at `65fba889597a22f7703b3337833fc1f0ca3c5cb1`.
- PR #3 established the reviewed v0.12.0 Wrangler-local D1 validation layer and merged at `02238c00150b059e9f73cb768e87a62a0d8b25e9`.
- PR #4 established the reviewed v0.13.0 guarded Cloudflare activation configuration and merged at `bb1b59427eaa906c5ae3e85a7daba9bdf2601770`.
- PR #6 fixed the Wrangler 4.129.0 remote migration invocation and merged at `73359c56825ea7d9b6bfa1245f513d23c9e08e30`; its exact final reviewed head `6020bb2c595d14328d3220226e997b3bbaf1471c` passed CI #83.
- The first real Streamarkr Worker + D1 activation is now deployed and manually verified.
- No live provider credentials, personal viewing data, or BANDMARKR resources were used.

## Cloudflare account-level setup and activation completed
Dedicated Streamarkr resources now exist and are active:
- D1 database `streamarkr` with EU jurisdiction;
- Worker `streamarkr-api`;
- D1 binding `DB` -> `streamarkr`;
- runtime secret `DEVICE_ACCESS_TOKEN` stored only in Cloudflare;
- Workers Builds connected to `mstpln/streamarkr` using `deploy/production` as the production branch;
- non-production builds disabled;
- `NODE_VERSION=22` configured;
- `STREAMARKR_D1_DATABASE_ID` stored only as a masked build secret;
- Workers Builds token granted D1 Edit in addition to its deployment permissions.

With explicit user authorization, deployment commit `0c62c574a2680a01ae06dde2c1362e2ec1b5369a` deployed the reviewed tree from `main` merge commit `73359c56825ea7d9b6bfa1245f513d23c9e08e30`. The Cloudflare build completed successfully.

Manual production verification confirmed:
- `/api/health` => `ok: true`, `service: streamarkr-worker`, `schemaVersion: 1`, `authConfigured: true`;
- remote D1 `app_meta` has `schema_version = 1`;
- `services` count is exactly 8;
- expected application tables plus `d1_migrations` are present.

## v0.10.2 reviewed baseline
The baseline remains the product-behavior safety net while infrastructure is migrated. It includes the full synthetic PWA experience and the hardened status, History, Library, Search, Detail, Discover, Alerts, export, offline and responsive behavior documented in `docs/STREAMARKR_STATE.md` and `docs/STREAMARKR_DECISIONS.md`.

Final baseline validation:
- Build: PASS.
- Logic/repository tests: **101/101 PASS**.
- Playwright browser/responsive QA: **27/27 PASS**.
- Folded proxy: 344×792 PASS.
- Unfolded proxy: 873×1000 PASS.
- Browser console/page errors: 0.

## v0.11.0 Worker + D1 foundation
PR #2 added normalized D1 schema, ownership-safe foreign keys, canonical title IDs/crosswalk preservation, multi-option availability identity, Worker auth/CORS/error safety, D1 repository boundaries, initial mutations, provider interfaces, backend-client seams, service-worker API-cache safety and exact-head CI checkout.

Final PR #2 validation:
- PWA build PASS
- Worker type-check PASS
- **120/120** tests PASS
- D1 semantics **5/5 PASS**
- browser QA **27/27 PASS**
- 0 console/page errors

## v0.12.0 Wrangler-local D1 validation
PR #3 added repository-pinned Wrangler 4.129.0, local-only Wrangler config, isolated Wrangler local D1 migration validation, CI gating, v0.12.0 version/cache synchronization and continuity updates. It merged only after exact-final-head review/CI passed.

## v0.13.0 — guarded Cloudflare activation
PR #4 added the guarded deployment architecture and PR #6 corrected the discovered Wrangler migration CLI incompatibility. The final deployment path:
- keeps the committed Wrangler config account-neutral;
- validates the build-only D1 UUID and independently resolves the literal remote database name `streamarkr` before mutation;
- verifies `DEVICE_ACCESS_TOKEN` exists;
- applies pending migrations with `--remote`;
- deploys only `streamarkr-api`;
- disables Wrangler auto-provisioning and auto-create;
- keeps normal `main` merges separate from production deploys through `deploy/production`.

Final PR #6 validation on exact head `6020bb2c595d14328d3220226e997b3bbaf1471c`, CI #83:
- PWA build PASS;
- Worker TypeScript build/type-check PASS;
- **126/126** logic/repository/Worker/client/security/deployment-config tests PASS;
- deterministic SQLite D1 semantics **5/5 PASS**;
- pinned Wrangler 4.129.0 local D1 validation PASS;
- Playwright browser/responsive QA **27/27 PASS**;
- folded 344×792 and unfolded 873×1000 PASS;
- zero smoke-journey console/page errors.

## Next work
1. Keep production deployment gated behind explicit authorization and `deploy/production`.
2. Set `APP_ORIGIN` once the real PWA hosting origin is known.
3. Move the frontend repository/data calls to the Worker backend while retaining IndexedDB as cache/offline support.
4. Add real TMDB metadata/search, then Trakt OAuth/history, then streaming availability in focused reviewed builds.
5. Replace placeholder service badges with properly sourced/licensed assets and complete physical Pixel 9 Pro Fold QA before V1.

## Remaining V1 limitations
- Current PWA UI still uses IndexedDB + synthetic providers.
- `APP_ORIGIN` is not yet configured because the final PWA hosting origin is not established.
- No live provider integration yet.
- Streaming-service marks remain placeholders pending properly sourced/licensed assets.
- Physical Pixel 9 Pro Fold QA remains required before V1 release.
