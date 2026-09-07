# Streamarkr Cloudflare foundation

This document describes the Worker + D1 foundation, local-only Cloudflare runtime validation, and the guarded v0.13.0 path for activating the dedicated Streamarkr resources.

## Isolation names
Use separate Streamarkr resources only:
- Worker: `streamarkr-api`
- D1: `streamarkr`
- QA Worker/D1 when introduced: `streamarkr-api-qa` / `streamarkr-qa`

Never reuse or bind BANDMARKR Worker, D1, R2, secrets, or production data.

## Current account-level state
The user explicitly created these dedicated Streamarkr resources in Cloudflare on 2026-09-07:
- D1 database `streamarkr`, created with EU jurisdiction;
- Worker `streamarkr-api`;
- Worker D1 binding `DB` -> `streamarkr`.

The Worker currently has only Cloudflare's temporary Hello World starter deployment. The Streamarkr D1 schema has not been migrated remotely, the reviewed `worker/index.ts` source has not been deployed, no provider credentials are configured, and no personal Streamarkr data has been written to D1.

## Current source boundary
- `worker/index.ts`: authenticated API routing.
- `worker/repository.ts`: D1 reads/writes and ownership-safe mutations.
- `worker/provider-contracts.ts`: provider interfaces only; no live adapter implementation is committed.
- `migrations/0001_initial.sql`: normalized schema aligned to the build plan.
- `src/lib/backend-client.ts`: browser-side Worker client boundary. The existing UI remains on IndexedDB/fake adapters until a later focused migration.

The D1 availability primary key is `(title_id, service_key, option_type)`, deliberately fixing the IndexedDB prototype limitation that could not retain subscription and rent/buy options for the same service simultaneously.

## Authentication
Every personal-data API route requires `Authorization: Bearer <device token>`. The expected token comes from the Worker secret `DEVICE_ACCESS_TOKEN`; it is never stored in source code or returned by the Worker. `/api/health` is public and only reports service/schema health plus whether authentication is configured.

CORS is deny-by-default for cross-origin requests. `APP_ORIGIN` must exactly match the approved PWA origin before cross-origin API access is allowed. The v0.13.0 activation build deliberately does not invent an application origin before the PWA hosting origin is decided.

## Local-only Wrangler validation
`wrangler.local.jsonc` is safe repository configuration for local D1 testing only:
- Worker name `streamarkr-api-local`;
- local database name `streamarkr-local`;
- `database_id` is an obvious non-production placeholder UUID;
- `preview_database_id` is a local identifier;
- no credentials or real account-level resource IDs are present.

Wrangler **4.129.0** is an exact `devDependency` recorded in `package.json` and `package-lock.json`, so normal `npm ci` installs the same CLI used by CI. `scripts/validate-wrangler-d1.mjs` executes that repository-local binary, verifies its version, uses ignored `.wrangler/test-d1` state, always passes `--local`, and explicitly disables Wrangler's automatic resource provisioning and draft-resource auto-creation flags. It applies the committed migrations and verifies schema/seed state afterward.

The local validator must never be changed to `--remote`, given a real database ID, or pointed at any BANDMARKR resource merely to make CI pass.

## Guarded remote configuration
The committed `wrangler.jsonc` is intentionally account-neutral. It declares:
- Worker name `streamarkr-api`;
- Worker source `worker/index.ts`;
- compatibility date;
- `keep_vars: true` so dashboard-managed runtime variables are not overwritten;
- required secret name `DEVICE_ACCESS_TOKEN`.

It deliberately does **not** contain the real D1 UUID.

`scripts/prepare-cloudflare-deploy.mjs` requires a build-only environment value named `STREAMARKR_D1_DATABASE_ID`. It validates that value as a non-placeholder UUID and generates an ignored `.wrangler/deploy/wrangler.generated.jsonc` containing exactly one D1 binding:
- binding `DB`;
- database name `streamarkr`;
- the supplied dedicated Streamarkr D1 UUID;
- migrations directory `migrations`.

The generated file and Wrangler redirect file live under `.wrangler/`, which is gitignored. The script never prints the UUID. Tests use only a synthetic UUID.

`npm run deploy:cloudflare` uses `scripts/deploy-cloudflare.mjs` and performs guarded preflight before any D1 mutation:
1. validate the build-supplied D1 UUID and prepare the generated account-specific configuration;
2. query D1 by the literal name `streamarkr` using the account-neutral Wrangler config and require Cloudflare's authoritative UUID for that named database to match `STREAMARKR_D1_DATABASE_ID`;
3. query the existing `streamarkr-api` Worker secret names and require `DEVICE_ACCESS_TOKEN` to already exist;
4. apply pending migrations specifically to the named remote database `streamarkr` with `--remote`; Wrangler 4.129.0 skips the confirmation prompt automatically in CI/non-interactive environments and does not accept `--yes` for this command;
5. deploy the reviewed Worker source;
6. explicitly pass `--x-provision=false` and `--x-auto-create=false` to all Wrangler account operations.

If D1 metadata does not identify the exact named database expected by the configured UUID, if secret metadata cannot be read, or if `DEVICE_ACCESS_TOKEN` is absent, the command stops before the D1 migration. The EU jurisdiction remains a creation-time account property recorded from the manual Cloudflare setup; current Wrangler `d1 info --json` exposes name/UUID but not jurisdiction, so the automated preflight validates the authoritative database identity without pretending it can re-verify jurisdiction. Wrangler deployments do not delete existing encrypted secrets, and `keep_vars` preserves dashboard-managed plaintext runtime variables.

## Workers Builds deployment gate
Do not connect ordinary `main` merges directly to production deployment. The intended setup is a dedicated production deployment branch that is advanced only after explicit user authorization.

For the existing `streamarkr-api` Worker, configure Workers Builds with:
- repository `mstpln/streamarkr`;
- production deployment branch: dedicated deployment branch, not `main`;
- build command `npm run build:cloudflare`;
- deploy command `npm run deploy:cloudflare`;
- non-production branch builds disabled;
- build secret `STREAMARKR_D1_DATABASE_ID` set in Cloudflare only;
- build variable `NODE_VERSION=22` so Cloudflare's build runtime matches repository CI;
- runtime secret `DEVICE_ACCESS_TOKEN` set under Worker Variables & Secrets before first Streamarkr deployment.

Because the deploy command performs a remote D1 migration, the Workers Builds API token must explicitly have **D1 Edit** in addition to permission to deploy Workers. Cloudflare's automatically-created Workers Builds token currently includes Workers Scripts Edit but does not include D1 Edit by default, while Cloudflare requires D1 Edit for D1 writes through the API. Therefore use or edit a user-scoped Workers Builds token for this account with at least the Worker deployment permissions required by Workers Builds plus **D1 Edit**, scoped only to the Streamarkr Cloudflare account as tightly as the dashboard allows. Never put the token value in GitHub, repository files, build logs, or chat.

This keeps normal PR merges reviewable without silently deploying production code. A deployment branch update remains an explicit production action and must not be performed without user authorization.

## Migration validation
Two independent local gates protect the initial SQL migration before remote activation:
1. `npm run test:d1` exercises syntax and semantics with Node 22 SQLite, including idempotence, canonical identity, foreign-key data safety, default-service behavior and multi-option availability.
2. `npm run test:d1:wrangler` applies the same committed migration through the repository-pinned Wrangler local D1 runtime and verifies schema version, seeded services, core table presence and Wrangler migration history.

`npm test` additionally validates the remote-config generator and deployment preflight with synthetic identifiers/metadata only. No automated test contacts the real Cloudflare account, real D1 database, or BANDMARKR.
