# Streamarkr Cloudflare foundation

This document describes the source-level Worker + D1 foundation and the local-only Cloudflare runtime validation layer. No remote Cloudflare resource has been created, bound, migrated, or deployed by this build.

## Isolation names
Use separate Streamarkr resources only:
- Worker: `streamarkr-api`
- D1: `streamarkr`
- QA Worker/D1 when introduced: `streamarkr-api-qa` / `streamarkr-qa`

Never reuse or bind BANDMARKR Worker, D1, R2, secrets, or production data.

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
`wrangler.local.jsonc` is safe repository configuration for local D1 testing only:
- Worker name `streamarkr-api-local`;
- local database name `streamarkr-local`;
- `database_id` is an obvious non-production placeholder UUID;
- `preview_database_id` is a local identifier;
- no credentials or real account-level resource IDs are present.

Wrangler **4.129.0** is an exact `devDependency` recorded in `package.json` and `package-lock.json`, so normal `npm ci` installs the same CLI used by CI. `scripts/validate-wrangler-d1.mjs` executes that repository-local binary, verifies its version, uses ignored `.wrangler/test-d1` state, always passes `--local`, and explicitly disables Wrangler's automatic resource provisioning and draft-resource auto-creation flags. It applies the committed migrations and verifies schema/seed state afterward. CI runs this check after the deterministic Node SQLite migration tests.

The local validator must never be changed to `--remote`, given a real database ID, or pointed at any BANDMARKR resource merely to make CI pass.

## Activating later
`wrangler.example.jsonc` remains intentionally non-active until the user explicitly authorizes separate Streamarkr Cloudflare resource creation. After the dedicated Streamarkr D1 resource exists, activate an account-specific config using its real identifier and add secrets only through Cloudflare secret storage. Do not commit secret values or private runtime data.

The local Wrangler validation pin does not itself create, provision, bind, migrate, or deploy a Cloudflare account resource. A remote activation step is a separate milestone and requires explicit user authorization.

## Migration validation
Two independent gates now protect the initial SQL migration before remote activation:
1. `npm run test:d1` exercises syntax and semantics with Node 22 SQLite, including idempotence, canonical identity, foreign-key data safety, default-service behavior and multi-option availability.
2. `npm run test:d1:wrangler` applies the same committed migration through the repository-pinned Wrangler local D1 runtime and verifies schema version, seeded services, core table presence and Wrangler migration history.

Both checks must pass on the literal final PR head before any remote D1 migration is considered.
