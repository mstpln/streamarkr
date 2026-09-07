# Streamarkr Cloudflare foundation

This document describes the source-level Worker + D1 foundation. No Cloudflare resource has been created, bound, migrated remotely, or deployed by this build.

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
- `src/lib/backend-client.ts`: browser-side Worker client boundary. The existing UI remains on IndexedDB/fake adapters until a later focused migration, so this build does not change working local behavior.

The D1 availability primary key is `(title_id, service_key, option_type)`, deliberately fixing the IndexedDB prototype limitation that could not retain subscription and rent/buy options for the same service simultaneously.

## Authentication
Every personal-data API route requires `Authorization: Bearer <device token>`. The expected token comes from the Worker secret `DEVICE_ACCESS_TOKEN`; it is never stored in source code or returned by the Worker. `/api/health` is public and only reports service/schema health plus whether authentication is configured.

CORS is deny-by-default for cross-origin requests. `APP_ORIGIN` must exactly match the approved PWA origin before cross-origin API access is allowed.

## Activating later
`wrangler.example.jsonc` is intentionally non-active until the separate Streamarkr D1 resource exists. When the user authorizes Cloudflare setup, create the resource in the Cloudflare UI, copy the example to the active Wrangler config with the real Streamarkr database identifier, and add secrets through Cloudflare secret storage. Do not put secret values in the config file.

The current repository does not yet pin Wrangler or the Cloudflare Vite plugin. That toolchain migration is a separate focused step so the existing reproducible `package-lock.json` and synthetic browser QA are not disrupted casually.

## Migration validation
The initial SQL migration is exercised in CI against Node 22's SQLite engine for syntax, idempotence, canonical identity, foreign-key data safety, default-service behavior, and the multi-option availability key. Once Wrangler is pinned, add a second migration check using Wrangler's local D1 simulator before any remote D1 migration is authorized.
