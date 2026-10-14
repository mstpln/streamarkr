# Streamarkr on Replit

## Run
- Runtime: Node.js 22, matching the repository's minimum version.
- Click **Run** to start the **Start application** workflow.
- Workflow command: `npm run build && node server.mjs 5000`.
- The existing TypeScript build generates `dist/` and the service-worker manifest; the existing static server serves the PWA on port 5000 for Replit Preview.
- After editing TypeScript, restart the workflow to rebuild the app.
- On a fresh checkout, install the pinned development toolchain with `npm ci`.
- The static server serves only the PWA shell, compiled JavaScript, stylesheet and public image assets. Repository files and private configuration are blocked, including traversal and symlink escapes.

## Preview scope
This preview runs the repository's existing synthetic/local mode. Movie/TV and availability data are fixtures, and changes persist in the browser's IndexedDB, not in a Replit database or the production Cloudflare D1 database.

No secrets are needed for local mode. The static preview does not serve the Cloudflare Worker API; Settings' Worker/D1 activation requires a separately configured same-origin Worker environment and is not supported by this preview workflow. Do not enter a production device token into this preview.

The existing Cloudflare resources, deployment branches, configuration, migrations, and secrets are unchanged. Running the preview never deploys or migrates production.

## Checks
- Run `npm run build` before the tests on a fresh checkout; the asset-staging test requires the generated service-worker manifest.
- `npm test`
- `npm run build:worker`
- `npm run test:d1`
- On Replit/Nix, use the configured system Chromium for browser QA: `PLAYWRIGHT_CHROMIUM_PATH="$(command -v chromium)" QA_BASE_URL="http://127.0.0.1:5000" npm run qa:browser`.
- The browser tests target the workflow port directly because the development-domain endpoint returned a proxy status response rather than the app during setup. The Replit Preview was verified separately.
- Outside Replit, the repository's standard browser setup is `npx playwright install chromium`.

Read `AGENTS.md` before changing application behavior and consult `docs/STREAMARKR_STATE.md` for backend/deployment continuity.
