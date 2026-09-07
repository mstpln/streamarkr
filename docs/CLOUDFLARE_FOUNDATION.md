# Streamarkr Cloudflare foundation

This document describes the Worker + D1 foundation, local-only validation, guarded deployment path, and current activated Streamarkr Cloudflare backend state.

## Isolation names
Use separate Streamarkr resources only:
- Worker: `streamarkr-api`
- D1: `streamarkr`
- QA Worker/D1 when introduced: `streamarkr-api-qa` / `streamarkr-qa`

Never reuse or bind BANDMARKR Worker, D1, R2, secrets, or production data.

## Current account-level state
The user explicitly created and activated these dedicated Streamarkr resources in Cloudflare on 2026-09-07:
- D1 database `streamarkr`, EU jurisdiction;
- Worker `streamarkr-api`;
- D1 binding `DB` -> `streamarkr`;
- Worker runtime secret `DEVICE_ACCESS_TOKEN` stored only in Cloudflare;
- Workers Builds connected to `mstpln/streamarkr` with production branch `deploy/production`, non-production builds disabled, `NODE_VERSION=22`, and masked build secret `STREAMARKR_D1_DATABASE_ID`;
- Workers Builds token with D1 Edit in addition to deployment permissions.

With explicit user authorization, deployment commit `0c62c574a2680a01ae06dde2c1362e2ec1b5369a` deployed the reviewed tree from `main` merge commit `73359c56825ea7d9b6bfa1245f513d23c9e08e30`. The Cloudflare build completed successfully.

Manual verification confirmed:
- `/api/health` => `ok: true`, `service: streamarkr-worker`, `schemaVersion: 1`, `authConfigured: true`;
- remote D1 `app_meta` contains `schema_version = 1`;
- exactly eight service registry rows exist;
- all expected application tables plus Wrangler's `d1_migrations` table are present.

No provider credentials, live provider calls, personal viewing data, or BANDMARKR resources were used during activation. `APP_ORIGIN` remains unset until the real PWA hosting origin is established.

## Current source boundary
- `worker/index.ts`: authenticated API routing.
- `worker/repository.ts`: D1 reads/writes and ownership-safe mutations.
- `worker/provider-contracts.ts`: provider interfaces only; no live adapter implementation is committed.
- `migrations/0001_initial.sql`: normalized schema aligned to the build plan.
- `src/lib/backend-client.ts`: browser-side Worker client boundary. The existing UI remains on IndexedDB/fake adapters until a later focused migration.

The D1 availability primary key is `(title_id, service_key, option_type)`, deliberately fixing the IndexedDB prototype limitation that could not retain subscription and rent/buy options for the same service simultaneously.

## Authentication
Every personal-data API route requires `Authorization: Bearer <device token>`. The expected token comes from the Worker secret `DEVICE_ACCESS_TOKEN`; it is never stored in source code or returned by the Worker. `/api/health` is public and only reports service/schema health plus whether authentication is configured.

CORS is deny-by-default for cross-origin requests. `APP_ORIGIN` must exactly match the approved PWA origin before cross-origin API access is allowed.

## Local-only Wrangler validation
`wrangler.local.jsonc` is safe repository configuration for local D1 testing only. Wrangler **4.129.0** is pinned in the repository. `scripts/validate-wrangler-d1.mjs` executes that repository-local binary, uses ignored `.wrangler/test-d1` state, always passes `--local`, disables automatic provisioning/auto-create, applies committed migrations and verifies schema version 1, eight seeded services, core tables and migration history.

The local validator must never be changed to `--remote`, given a real database ID, or pointed at BANDMARKR merely to make CI pass.

## Guarded remote configuration
The committed `wrangler.jsonc` is intentionally account-neutral and contains no real D1 UUID or secret value. `scripts/prepare-cloudflare-deploy.mjs` requires build-only `STREAMARKR_D1_DATABASE_ID`, validates it, and generates account-specific config only under ignored `.wrangler/deploy/` state.

`npm run deploy:cloudflare` performs guarded preflight before mutation:
1. validate the build-supplied D1 UUID and prepare generated config;
2. resolve literal remote D1 name `streamarkr` and require Cloudflare's authoritative UUID to match;
3. verify existing Worker secret `DEVICE_ACCESS_TOKEN`;
4. apply pending migrations to named remote database `streamarkr` with `--remote`;
5. deploy reviewed `streamarkr-api` Worker source;
6. disable Wrangler automatic provisioning and draft-resource auto-create on account operations.

Wrangler 4.129.0 skips the D1 migration confirmation prompt in CI/non-interactive environments and does not accept `--yes` for `d1 migrations apply`.

## Workers Builds deployment gate
Normal `main` merges do not deploy production. Workers Builds watches dedicated branch `deploy/production`, which must be advanced only after explicit user authorization.

Current production build settings:
- repository `mstpln/streamarkr`;
- production branch `deploy/production`;
- build command `npm run build:cloudflare`;
- deploy command `npm run deploy:cloudflare`;
- non-production builds disabled;
- build secret `STREAMARKR_D1_DATABASE_ID` stored only in Cloudflare;
- build variable `NODE_VERSION=22`;
- runtime secret `DEVICE_ACCESS_TOKEN` stored only in Cloudflare;
- Workers Builds API token includes D1 Edit plus required Worker deployment permissions.

Never put token values, the real D1 UUID, personal data, or private runtime data in GitHub, repository files, logs, or chat.

## Migration validation
Two independent local gates protect migrations before remote application:
1. `npm run test:d1` exercises migration syntax/semantics with Node 22 SQLite.
2. `npm run test:d1:wrangler` applies the same migration through pinned Wrangler local D1 and verifies schema/service/core-table/migration-history state.

`npm test` additionally validates remote-config generation and deployment preflight with synthetic identifiers only. Automated tests do not contact the real Cloudflare account, real D1 database, or BANDMARKR.
