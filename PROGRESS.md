# Streamarkr — Build Progress

Updated: 2026-09-07.

## Authoritative repository status
- Repository: `mstpln/streamarkr` (public).
- PR #1 established the reviewed v0.10.2 synthetic/local baseline and was merged into `main` at `438997dedc282366339e6507d826441d99a81adc`.
- PR #2 established the reviewed v0.11.0 Worker + D1 source foundation and was merged into `main` at `65fba889597a22f7703b3337833fc1f0ca3c5cb1`.
- Current focused build: **v0.12.0 Wrangler-local D1 validation** on `feat/wrangler-local-d1-v0120`.
- No remote Cloudflare resource has been created, bound, migrated, or deployed.
- No live provider credentials, API keys, OAuth tokens, personal viewing data, or BANDMARKR resources are used.

## v0.10.2 reviewed baseline
The baseline remains the product-behavior safety net while infrastructure is migrated. It includes the full synthetic PWA experience and the hardened status, History, Library, Search, Detail, Discover, Alerts, export, offline and responsive behavior documented in `docs/STREAMARKR_STATE.md` and `docs/STREAMARKR_DECISIONS.md`.

Final baseline validation before merge:
- Build: PASS.
- Logic/repository tests: **101/101 PASS**.
- Playwright browser/responsive QA: **27/27 PASS**.
- Folded proxy: 344×792 PASS.
- Unfolded proxy: 873×1000 PASS.
- Browser console/page errors in smoke journey: 0.

## v0.11.0 — Worker + D1 backend foundation on main
PR #2 added:
- normalized D1 schema and ownership-safe foreign keys;
- canonical media-type/TMDB identity and stable provider crosswalk preservation;
- multi-option `(title_id, service_key, option_type)` availability identity;
- Worker auth, exact-origin CORS, request IDs and sanitized errors;
- D1 repository boundary plus initial snapshot/Library/rating/alert mutations;
- provider interfaces only, no live adapters;
- `BackendSnapshot` / `WorkerBackendClient` seams while the UI stays on IndexedDB + synthetic providers;
- service-worker cache boundaries that exclude personal `/api/`, cross-origin and Authorization-bearing requests;
- exact-PR-head CI checkout hardening.

Final PR #2 validation:
- `npm ci`: PASS
- PWA build: PASS
- Worker TypeScript build/type-check: PASS
- logic/repository/Worker/client/security tests: **120/120 PASS**
- D1 migration semantics: **5/5 PASS**
- Playwright browser/responsive QA: **27/27 PASS**
- Folded proxy 344×792: PASS
- Unfolded proxy 873×1000: PASS
- Smoke-journey console/page errors: 0

## v0.12.0 — Wrangler-local D1 validation
Implemented on the current branch:
- app/cache version bumped together to v0.12.0 / `streamarkr-v0.12.0`;
- added local-only `wrangler.local.jsonc` with a non-production placeholder database identifier and local preview database ID;
- pinned the local D1 validation CLI invocation to Wrangler **4.129.0**;
- added `scripts/validate-wrangler-d1.mjs` and `npm run test:d1:wrangler`;
- validator removes only ignored `.wrangler/test-d1` state, applies committed migrations with `--local`, then queries the local D1 database and asserts schema version 1, eight seeded services, the `titles` table, and Wrangler migration-history table;
- CI now runs Wrangler-local D1 validation in addition to the existing deterministic Node SQLite migration checks;
- README and continuity docs are updated to distinguish local runtime validation from remote Cloudflare activation.

This build deliberately does **not** add a real Cloudflare D1 ID, secret, remote binding, account resource, provider credential, personal data, or deployment.

## v0.12.0 final gate
Before merge readiness, the literal final PR head must pass:
- `npm ci --no-audit --no-fund`
- PWA build
- Worker TypeScript build/type-check
- **120/120** logic/repository/Worker/client/security tests
- **5/5** deterministic Node SQLite D1 semantics
- Wrangler 4.129.0 local D1 migration validation
- **27/27** Playwright browser/responsive QA
- folded 344×792 and unfolded 873×1000
- zero smoke-journey console/page errors
- review with zero unresolved blocking findings

## Next work after v0.12.0
1. Ask for explicit user approval before any account-level Cloudflare creation.
2. If approved, create completely separate Streamarkr Worker/D1 resources and activate a real config without committing secrets or private runtime data.
3. Add/finish Worker personal-data mutation routes as the frontend moves off direct IndexedDB writes.
4. Migrate the PWA data repository to Worker-backed primary state while retaining IndexedDB for cached/offline first paint.
5. Add real provider adapters in focused builds: TMDB first, then Trakt OAuth/history, then streaming availability, always with synthetic contract tests and secrets outside GitHub.

## Remaining V1 limitations
- No live provider integration yet.
- No actual Streamarkr Cloudflare resource or production deployment yet.
- Streaming-service marks are still placeholders pending properly sourced/licensed assets.
- Physical Pixel 9 Pro Fold QA remains required before V1 release.
