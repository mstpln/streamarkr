import { readFile, writeFile } from 'node:fs/promises';

async function text(path) { return readFile(path, 'utf8'); }
async function write(path, content) { await writeFile(path, content); }
function replaceRequired(content, before, after, label) {
  if (!content.includes(before)) throw new Error(`Missing expected ${label}`);
  return content.replace(before, after);
}

const packageJson = JSON.parse(await text('package.json'));
packageJson.version = '0.18.0';
packageJson.scripts['prepare:worker-assets'] = 'node scripts/prepare-worker-assets.mjs';
packageJson.scripts['build:cloudflare'] = 'npm run build && npm run build:worker && npm run prepare:worker-assets';
await write('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);

const packageLock = JSON.parse(await text('package-lock.json'));
packageLock.version = '0.18.0';
packageLock.packages[''].version = '0.18.0';
await write('package-lock.json', `${JSON.stringify(packageLock, null, 2)}\n`);

let sw = await text('sw.js');
sw = replaceRequired(sw, "const CACHE_VERSION = 'streamarkr-v0.17.0';", "const CACHE_VERSION = 'streamarkr-v0.18.0';", 'service-worker cache version');
await write('sw.js', sw);

let settings = await text('src/ui/screens/settings.ts');
settings = replaceRequired(settings, 'v0.17.0 (backend activation migration)', 'v0.18.0 (same-origin Worker hosting)', 'Settings version');
await write('src/ui/screens/settings.ts', settings);

await write('scripts/prepare-worker-assets.mjs', `import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(MODULE_DIR, '..');
const DEFAULT_OUTPUT_DIR = path.join(PROJECT_ROOT, '.wrangler', 'site');
const ROOT_FILES = ['index.html', 'manifest.webmanifest', 'sw.js', 'sw-manifest.json'];

export async function prepareWorkerAssets({ projectRoot = PROJECT_ROOT, outputDir = DEFAULT_OUTPUT_DIR } = {}) {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  for (const file of ROOT_FILES) {
    await cp(path.join(projectRoot, file), path.join(outputDir, file));
  }

  await cp(path.join(projectRoot, 'dist'), path.join(outputDir, 'dist'), { recursive: true });
  await mkdir(path.join(outputDir, 'src', 'styles'), { recursive: true });
  await cp(path.join(projectRoot, 'src', 'styles', 'main.css'), path.join(outputDir, 'src', 'styles', 'main.css'));
  await cp(path.join(projectRoot, 'public'), path.join(outputDir, 'public'), { recursive: true });

  return outputDir;
}

const invokedAsScript = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (invokedAsScript) {
  try {
    await prepareWorkerAssets();
    console.log('Prepared Streamarkr same-origin Worker static assets.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Failed to prepare Streamarkr Worker assets.');
    process.exitCode = 1;
  }
}
`);

let prepareDeploy = await text('scripts/prepare-cloudflare-deploy.mjs');
prepareDeploy = replaceRequired(
  prepareDeploy,
  `    secrets: {\n      required: ['DEVICE_ACCESS_TOKEN']\n    },\n    d1_databases: [`,
  `    secrets: {\n      required: ['DEVICE_ACCESS_TOKEN']\n    },\n    assets: {\n      directory: '../site',\n      not_found_handling: 'single-page-application',\n      run_worker_first: ['/api/*']\n    },\n    d1_databases: [`,
  'generated static-assets config'
);
await write('scripts/prepare-cloudflare-deploy.mjs', prepareDeploy);

let deploy = await text('scripts/deploy-cloudflare.mjs');
deploy = replaceRequired(deploy, "import { spawnSync } from 'node:child_process';\n", "import { spawnSync } from 'node:child_process';\nimport { access } from 'node:fs/promises';\n", 'deploy fs import');
deploy = replaceRequired(
  deploy,
  "const EXPECTED_D1_NAME = 'streamarkr';\n",
  "const EXPECTED_D1_NAME = 'streamarkr';\nconst WORKER_ASSET_ROOT = path.join(PROJECT_ROOT, '.wrangler', 'site');\nconst REQUIRED_WORKER_ASSETS = ['index.html', 'manifest.webmanifest', 'sw.js', 'sw-manifest.json', path.join('dist', 'main.js'), path.join('src', 'styles', 'main.css')];\n",
  'deploy asset constants'
);
deploy = replaceRequired(
  deploy,
  `function parseJsonMetadata(output, label) {`,
  `export async function assertWorkerAssetBundle(assetRoot = WORKER_ASSET_ROOT) {\n  try {\n    await Promise.all(REQUIRED_WORKER_ASSETS.map((asset) => access(path.join(assetRoot, asset))));\n  } catch {\n    throw new Error('Same-origin Streamarkr Worker asset bundle is missing; run npm run build:cloudflare before deployment.');\n  }\n}\n\nfunction parseJsonMetadata(output, label) {`,
  'deploy asset preflight'
);
deploy = replaceRequired(
  deploy,
  `export async function deployCloudflare() {\n  const databaseId = validateD1DatabaseId(process.env.STREAMARKR_D1_DATABASE_ID);\n  await prepareCloudflareDeploy({ databaseId });`,
  `export async function deployCloudflare() {\n  const databaseId = validateD1DatabaseId(process.env.STREAMARKR_D1_DATABASE_ID);\n  await assertWorkerAssetBundle();\n  await prepareCloudflareDeploy({ databaseId });`,
  'deploy asset preflight call'
);
await write('scripts/deploy-cloudflare.mjs', deploy);

let worker = await text('worker/index.ts');
worker = replaceRequired(
  worker,
  `function corsHeaders(request: Request, env: Env): Record<string, string> {\n  const origin = request.headers.get('origin');\n  if (!origin || !env.APP_ORIGIN || origin !== env.APP_ORIGIN) return {};\n  return {\n    'access-control-allow-origin': origin,\n    'access-control-allow-credentials': 'true',\n    'access-control-allow-headers': 'authorization, content-type',\n    'access-control-allow-methods': 'GET, PUT, DELETE, POST, OPTIONS',\n    vary: 'Origin'\n  };\n}\n\nfunction matchesAppOrigin(request: Request, url: URL, env: Env): boolean {\n  if (!env.APP_ORIGIN) return false;\n  const origin = request.headers.get('origin');\n  if (origin) return origin === env.APP_ORIGIN;\n  return url.origin === env.APP_ORIGIN;\n}`,
  `function appOrigin(url: URL, env: Env): string {\n  const configured = env.APP_ORIGIN?.trim();\n  return configured || url.origin;\n}\n\nfunction corsHeaders(request: Request, url: URL, env: Env): Record<string, string> {\n  const origin = request.headers.get('origin');\n  const expectedOrigin = appOrigin(url, env);\n  if (!origin || origin !== expectedOrigin) return {};\n  return {\n    'access-control-allow-origin': origin,\n    'access-control-allow-credentials': 'true',\n    'access-control-allow-headers': 'authorization, content-type',\n    'access-control-allow-methods': 'GET, PUT, DELETE, POST, OPTIONS',\n    vary: 'Origin'\n  };\n}\n\nfunction matchesAppOrigin(request: Request, url: URL, env: Env): boolean {\n  const expectedOrigin = appOrigin(url, env);\n  const origin = request.headers.get('origin');\n  if (origin) return origin === expectedOrigin;\n  return url.origin === expectedOrigin;\n}`,
  'origin helpers'
);
worker = replaceRequired(worker, `const responseHeaders = { ...corsHeaders(request, env), 'x-request-id': requestId };`, `const responseHeaders = { ...corsHeaders(request, url, env), 'x-request-id': requestId };`, 'CORS call');
worker = replaceRequired(worker, `if (!env.APP_ORIGIN || request.headers.get('origin') !== env.APP_ORIGIN) {`, `if (request.headers.get('origin') !== appOrigin(url, env)) {`, 'preflight origin check');
worker = replaceRequired(worker, `    if (!env.APP_ORIGIN) return json({ error: 'browser_auth_not_configured' }, 503, responseHeaders);\n`, '', 'obsolete APP_ORIGIN bootstrap gate');
worker = replaceRequired(worker, `if (suppliedOrigin && (!env.APP_ORIGIN || suppliedOrigin !== env.APP_ORIGIN)) {`, `if (suppliedOrigin && suppliedOrigin !== appOrigin(url, env)) {`, 'authenticated origin check');
await write('worker/index.ts', worker);

let authTests = await text('tests/browser-auth.test.ts');
authTests = replaceRequired(
  authTests,
  `test('browser bootstrap fails closed when origin configuration is absent or mismatched', async () => {\n  const unconfigured = await handleRequest(bootstrapRequest(), env({ APP_ORIGIN: undefined }));\n  assert.equal(unconfigured.status, 503);\n  assert.equal((await unconfigured.json() as { error: string }).error, 'browser_auth_not_configured');\n\n  const mismatch = await handleRequest(bootstrapRequest('https://evil.example'), env());\n  assert.equal(mismatch.status, 403);\n  assert.equal((await mismatch.json() as { error: string }).error, 'origin_not_allowed');\n\n  const badToken = await handleRequest(bootstrapRequest('https://app.example', 'wrong'), env());\n  assert.equal(badToken.status, 401);\n});`,
  `test('browser bootstrap safely defaults to the serving origin when APP_ORIGIN is unset', async () => {\n  const selfOriginEnv = env({ APP_ORIGIN: undefined });\n  const bootstrap = await handleRequest(bootstrapRequest('https://worker.example'), selfOriginEnv);\n  assert.equal(bootstrap.status, 200);\n  assert.equal(bootstrap.headers.get('access-control-allow-origin'), 'https://worker.example');\n  const cookie = (bootstrap.headers.get('set-cookie') ?? '').split(';')[0];\n\n  const sameOriginWithoutOriginHeader = await handleRequest(new Request('https://worker.example/api/auth/session', {\n    headers: { cookie }\n  }), selfOriginEnv);\n  assert.equal(sameOriginWithoutOriginHeader.status, 200);\n  assert.deepEqual(await sameOriginWithoutOriginHeader.json(), { authenticated: true, method: 'browser-session' });\n\n  const crossOrigin = await handleRequest(bootstrapRequest('https://evil.example'), selfOriginEnv);\n  assert.equal(crossOrigin.status, 403);\n  assert.equal((await crossOrigin.json() as { error: string }).error, 'origin_not_allowed');\n});\n\ntest('browser bootstrap fails closed for an explicitly configured mismatched origin or bad token', async () => {\n  const mismatch = await handleRequest(bootstrapRequest('https://evil.example'), env());\n  assert.equal(mismatch.status, 403);\n  assert.equal((await mismatch.json() as { error: string }).error, 'origin_not_allowed');\n\n  const badToken = await handleRequest(bootstrapRequest('https://app.example', 'wrong'), env());\n  assert.equal(badToken.status, 401);\n});`,
  'browser origin tests'
);
await write('tests/browser-auth.test.ts', authTests);

let deployTests = await text('tests/cloudflare-deploy-config.test.mjs');
deployTests = replaceRequired(deployTests, `import { mkdtemp, readFile, rm } from 'node:fs/promises';`, `import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';`, 'deploy test fs imports');
deployTests = replaceRequired(deployTests, `import { assertDedicatedD1Info, assertRequiredSecretNames } from '../scripts/deploy-cloudflare.mjs';`, `import { assertDedicatedD1Info, assertRequiredSecretNames, assertWorkerAssetBundle } from '../scripts/deploy-cloudflare.mjs';\nimport { prepareWorkerAssets } from '../scripts/prepare-worker-assets.mjs';`, 'deploy test imports');
deployTests = replaceRequired(
  deployTests,
  `  assert.deepEqual(config.secrets.required, ['DEVICE_ACCESS_TOKEN']);\n  assert.deepEqual(config.d1_databases, [{`,
  `  assert.deepEqual(config.secrets.required, ['DEVICE_ACCESS_TOKEN']);\n  assert.deepEqual(config.assets, {\n    directory: '../site',\n    not_found_handling: 'single-page-application',\n    run_worker_first: ['/api/*']\n  });\n  assert.deepEqual(config.d1_databases, [{`,
  'generated asset config assertion'
);
deployTests = replaceRequired(
  deployTests,
  `  assert.equal(packageJson.scripts['deploy:cloudflare'], 'node scripts/deploy-cloudflare.mjs');\n\n  assert.match(deployScript, /'d1', 'info', EXPECTED_D1_NAME/);`,
  `  assert.equal(packageJson.scripts['deploy:cloudflare'], 'node scripts/deploy-cloudflare.mjs');\n  assert.equal(packageJson.scripts['prepare:worker-assets'], 'node scripts/prepare-worker-assets.mjs');\n  assert.equal(packageJson.scripts['build:cloudflare'], 'npm run build && npm run build:worker && npm run prepare:worker-assets');\n\n  assert.match(deployScript, /assertWorkerAssetBundle/);\n  assert.match(deployScript, /'d1', 'info', EXPECTED_D1_NAME/);`,
  'deployment bundle script assertions'
);
deployTests = replaceRequired(
  deployTests,
  `    assert.equal(generated.name, 'streamarkr-api');\n    assert.equal(generated.d1_databases[0].database_id, SYNTHETIC_D1_ID);`,
  `    assert.equal(generated.name, 'streamarkr-api');\n    assert.deepEqual(generated.assets, {\n      directory: '../site',\n      not_found_handling: 'single-page-application',\n      run_worker_first: ['/api/*']\n    });\n    assert.equal(generated.d1_databases[0].database_id, SYNTHETIC_D1_ID);`,
  'written generated asset config assertion'
);
deployTests += `\n\ntest('stages only deployable PWA assets for same-origin Worker hosting', async () => {\n  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'streamarkr-worker-assets-'));\n  try {\n    await prepareWorkerAssets({ projectRoot: PROJECT_ROOT, outputDir });\n    await assertWorkerAssetBundle(outputDir);\n    await stat(path.join(outputDir, 'public', 'icons', 'icon-192.png'));\n    await assert.rejects(readFile(path.join(outputDir, 'package.json'), 'utf8'), { code: 'ENOENT' });\n    await assert.rejects(readFile(path.join(outputDir, 'docs', 'STREAMARKR_STATE.md'), 'utf8'), { code: 'ENOENT' });\n  } finally {\n    await rm(outputDir, { recursive: true, force: true });\n  }\n});\n`;
await write('tests/cloudflare-deploy-config.test.mjs', deployTests);

let ci = await text('.github/workflows/ci.yml');
ci = replaceRequired(
  ci,
  `      - name: Build PWA\n        run: npm run build\n      - name: Type-check Worker\n        run: npm run build:worker\n`,
  `      - name: Build same-origin Worker + PWA bundle\n        run: npm run build:cloudflare\n`,
  'CI Cloudflare bundle build'
);
await write('.github/workflows/ci.yml', ci);

const buildState = JSON.parse(await text('docs/STREAMARKR_BUILD_STATE.json'));
buildState._readMeFirst = 'v0.18.0 packages the existing PWA as Cloudflare Worker static assets on the same Streamarkr Worker origin and lets browser auth safely default to that serving origin when APP_ORIGIN is unset. Production deployment and migration of real personal data still require fresh explicit authorization.';
buildState.appVersion = '0.18.0';
buildState.cacheVersion = 'streamarkr-v0.18.0';
buildState.generatedAt = new Date().toISOString();
buildState.targetArchitecture.status = 'Dedicated Streamarkr Worker/D1 foundation plus v0.18.0 same-origin Worker static-asset hosting source is implemented; production deployment and live providers remain pending explicit authorization';
buildState.pwa.productionHosting = 'Cloudflare Worker static assets from generated .wrangler/site bundle; SPA fallback with /api/* routed Worker-first on the same origin';
buildState.backendFoundation.cors = 'same-origin browser requests default to the request URL origin when APP_ORIGIN is unset; an explicit APP_ORIGIN remains an exact-origin override for controlled alternate hosting';
buildState.backendFoundation.browserSessionOriginRule = 'cookie-auth requests require the effective app origin; by default this is the same Worker serving origin, while explicit APP_ORIGIN can override it exactly';
buildState.deploymentPolicy.v0180ProductionDeploymentAuthorized = false;
await write('docs/STREAMARKR_BUILD_STATE.json', `${JSON.stringify(buildState, null, 2)}\n`);

console.log('Applied v0.18.0 same-origin Worker hosting build changes.');
