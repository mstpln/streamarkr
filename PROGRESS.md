# Streamarkr — Build Progress

Updated: 2026-09-07.

## Authoritative repository status
- Repository: `mstpln/streamarkr` (public).
- PR #1 established the reviewed v0.10.2 synthetic/local baseline and merged at `438997dedc282366339e6507d826441d99a81adc`.
- PR #2 established the reviewed v0.11.0 Worker + D1 source foundation and merged at `65fba889597a22f7703b3337833fc1f0ca3c5cb1`.
- PR #3 established the reviewed v0.12.0 Wrangler-local D1 validation layer and merged at `02238c00150b059e9f73cb768e87a62a0d8b25e9`.
- PR #4 established the reviewed v0.13.0 guarded Cloudflare activation configuration and merged at `bb1b59427eaa906c5ae3e85a7daba9bdf2601770`.
- Final reviewed PR #4 head: `f885a664d48646927940b178aaa47756bcff611b`; CI run #78 passed on that exact head.
- No real Streamarkr Worker source or D1 migration has yet been deployed remotely.
- No live provider credentials, API keys, OAuth tokens, personal viewing data, or BANDMARKR resources are used.

## Cloudflare account-level setup completed manually
With explicit user approval, these dedicated resources now exist:
- D1 database `streamarkr` with EU jurisdiction;
- Worker `streamarkr-api`;
- D1 binding `DB` -> `streamarkr`.

The Worker currently serves only Cloudflare's temporary Hello World starter. The D1 database has not received the Streamarkr schema or personal data.

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
PR #4 is merged. It added:
- app/cache version v0.13.0 / `streamarkr-v0.13.0`;
- account-neutral committed `wrangler.jsonc` with exact Worker name `streamarkr-api`, source entrypoint, `keep_vars: true`, and required secret declaration for `DEVICE_ACCESS_TOKEN`;
- no real D1 UUID or secret value in repository source;
- `scripts/prepare-cloudflare-deploy.mjs` to validate build-only `STREAMARKR_D1_DATABASE_ID` and generate the account-specific `DB` -> `streamarkr` binding only under ignored `.wrangler/deploy/` state;
- independent remote D1 identity verification: resolve literal database name `streamarkr` through Cloudflare and require the authoritative UUID to match the build-supplied UUID before any mutation;
- guarded deployment preflight requiring `DEVICE_ACCESS_TOKEN` before D1 migration or Worker deploy;
- remote migrations targeting named database `streamarkr` with `--remote --yes`, followed by Worker deploy, while Wrangler automatic provisioning and auto-create are disabled;
- deterministic deployment-config tests using only synthetic UUIDs;
- deployment policy preventing normal `main` merges from becoming production deployments.

Final PR #4 validation on exact head `f885a664d48646927940b178aaa47756bcff611b`, CI #78:
- PWA build PASS;
- Worker TypeScript build/type-check PASS;
- **126/126** logic/repository/Worker/client/security/deployment-config tests PASS;
- deterministic SQLite D1 semantics **5/5 PASS**;
- pinned Wrangler 4.129.0 local D1 validation PASS;
- Playwright browser/responsive QA **27/27 PASS**;
- folded 344×792 and unfolded 873×1000 PASS;
- zero smoke-journey console/page errors.

Merging v0.13.0 did **not** authorize or trigger a production deployment. The first real Streamarkr deployment remains a separate explicit action after Cloudflare runtime/build secrets and the dedicated deployment branch are configured.

## Next work
1. Configure `DEVICE_ACCESS_TOKEN` as a Worker runtime secret in Cloudflare.
2. Connect the existing `streamarkr-api` Worker to `mstpln/streamarkr` using a dedicated production deployment branch, not `main`.
3. Disable non-production branch builds, set build variable `NODE_VERSION=22`, and set masked build secret `STREAMARKR_D1_DATABASE_ID` to the dedicated `streamarkr` database UUID.
4. Use a user-scoped Workers Builds token with Worker deployment permission plus **D1 Edit**, scoped to the Streamarkr account as tightly as Cloudflare permits.
5. With explicit user authorization, advance the deployment branch to the reviewed/merged source. That build applies the initial D1 migration and deploys the reviewed Streamarkr Worker.
6. Verify `/api/health` and D1 migration state with no personal data.
7. Then continue backend migration and real providers in focused builds: UI repository -> Worker, TMDB, Trakt OAuth/history, streaming availability.

## Remaining V1 limitations
- Current PWA still uses IndexedDB + synthetic providers.
- Reviewed Streamarkr Worker not yet deployed.
- Real D1 schema not yet migrated remotely.
- No live provider integration yet.
- Streaming-service marks remain placeholders pending properly sourced/licensed assets.
- Physical Pixel 9 Pro Fold QA remains required before V1 release.
