import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { assertDedicatedD1Info, assertRequiredSecretNames, assertWorkerAssetBundle } from '../scripts/deploy-cloudflare.mjs';
import { prepareWorkerAssets } from '../scripts/prepare-worker-assets.mjs';
import {
  buildRemoteConfig,
  prepareCloudflareDeploy,
  validateD1DatabaseId
} from '../scripts/prepare-cloudflare-deploy.mjs';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SYNTHETIC_D1_ID = '12345678-1234-4234-8234-123456789abc';

test('package manifest and lockfile versions stay synchronized', async () => {
  const packageJson = JSON.parse(await readFile(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
  const packageLock = JSON.parse(await readFile(path.join(PROJECT_ROOT, 'package-lock.json'), 'utf8'));

  assert.equal(packageLock.version, packageJson.version);
  assert.equal(packageLock.packages?.['']?.version, packageJson.version);
});

test('machine-readable build state stays valid and synchronized with the app/cache version', async () => {
  const packageJson = JSON.parse(await readFile(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
  const buildState = JSON.parse(await readFile(path.join(PROJECT_ROOT, 'docs', 'STREAMARKR_BUILD_STATE.json'), 'utf8'));

  assert.equal(buildState.appVersion, packageJson.version);
  assert.equal(buildState.cacheVersion, `streamarkr-v${packageJson.version}`);
  assert.equal(buildState.schemaVersion, 1);
  assert.equal(buildState.repository?.fullName, 'mstpln/streamarkr');
});

test('rejects missing, malformed, and placeholder D1 identifiers', () => {
  assert.throws(() => validateD1DatabaseId(undefined), /STREAMARKR_D1_DATABASE_ID/);
  assert.throws(() => validateD1DatabaseId('not-a-uuid'), /STREAMARKR_D1_DATABASE_ID/);
  assert.throws(() => validateD1DatabaseId('00000000-0000-0000-0000-000000000000'), /STREAMARKR_D1_DATABASE_ID/);
});

test('builds only the dedicated Streamarkr Worker and D1 binding', () => {
  const config = buildRemoteConfig(SYNTHETIC_D1_ID);
  assert.equal(config.name, 'streamarkr-api');
  assert.equal(config.keep_vars, true);
  assert.deepEqual(config.secrets.required, ['DEVICE_ACCESS_TOKEN']);
  assert.deepEqual(config.assets, {
    directory: '../site',
    not_found_handling: 'single-page-application',
    run_worker_first: ['/api/*']
  });
  assert.deepEqual(config.d1_databases, [{
    binding: 'DB',
    database_name: 'streamarkr',
    database_id: SYNTHETIC_D1_ID,
    migrations_dir: '../../migrations'
  }]);
  assert.doesNotMatch(JSON.stringify(config), /bandmarkr/i);
});

test('refuses remote migration/deployment when D1 name and configured UUID do not match', () => {
  assert.doesNotThrow(() => assertDedicatedD1Info({ name: 'streamarkr', uuid: SYNTHETIC_D1_ID }, SYNTHETIC_D1_ID));
  assert.throws(
    () => assertDedicatedD1Info({ name: 'different-db', uuid: SYNTHETIC_D1_ID }, SYNTHETIC_D1_ID),
    /does not match the dedicated Streamarkr database/
  );
  assert.throws(
    () => assertDedicatedD1Info({ name: 'streamarkr', uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, SYNTHETIC_D1_ID),
    /does not match the dedicated Streamarkr database/
  );
  assert.throws(() => assertDedicatedD1Info(null, SYNTHETIC_D1_ID), /Could not verify/);
});

test('refuses remote migration/deployment when the device secret is absent', () => {
  assert.doesNotThrow(() => assertRequiredSecretNames([{ name: 'DEVICE_ACCESS_TOKEN', type: 'secret_text' }]));
  assert.throws(() => assertRequiredSecretNames([]), /refusing to migrate or deploy/);
  assert.throws(() => assertRequiredSecretNames([{ name: 'OTHER_SECRET' }]), /refusing to migrate or deploy/);
  assert.throws(() => assertRequiredSecretNames(null), /Could not verify/);
});

test('committed Wrangler config is account-neutral and deployment is guarded', async () => {
  const committedConfig = JSON.parse(await readFile(path.join(PROJECT_ROOT, 'wrangler.jsonc'), 'utf8'));
  const packageJson = JSON.parse(await readFile(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
  const gitignore = await readFile(path.join(PROJECT_ROOT, '.gitignore'), 'utf8');
  const deployScript = await readFile(path.join(PROJECT_ROOT, 'scripts', 'deploy-cloudflare.mjs'), 'utf8');

  assert.equal(committedConfig.name, 'streamarkr-api');
  assert.equal(committedConfig.keep_vars, true);
  assert.deepEqual(committedConfig.secrets.required, ['DEVICE_ACCESS_TOKEN']);
  assert.equal(Object.hasOwn(committedConfig, 'd1_databases'), false);
  assert.match(gitignore, /^\.wrangler\/$/m);
  assert.equal(packageJson.scripts['deploy:cloudflare'], 'node scripts/deploy-cloudflare.mjs');
  assert.equal(packageJson.scripts['prepare:worker-assets'], 'node scripts/prepare-worker-assets.mjs');
  assert.equal(packageJson.scripts['build:cloudflare'], 'npm run build && npm run build:worker && npm run prepare:worker-assets');

  assert.match(deployScript, /assertWorkerAssetBundle/);
  assert.match(deployScript, /'d1', 'info', EXPECTED_D1_NAME/);
  assert.match(deployScript, /ACCOUNT_NEUTRAL_CONFIG_PATH/);
  assert.match(deployScript, /assertDedicatedD1Info/);
  assert.match(deployScript, /secret', 'list'/);
  assert.match(deployScript, /'d1', 'migrations', 'apply', EXPECTED_D1_NAME/);
  assert.match(deployScript, /'--remote'/);
  assert.doesNotMatch(deployScript, /'--yes'/);
  assert.match(deployScript, /'deploy'/);
  assert.match(deployScript, /--x-provision=false/);
  assert.match(deployScript, /--x-auto-create=false/);
  assert.doesNotMatch(deployScript, /bandmarkr/i);
});

test('writes generated deployment configuration outside tracked source', async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'streamarkr-cloudflare-'));
  try {
    const { generatedConfigPath, redirectPath } = await prepareCloudflareDeploy({
      databaseId: SYNTHETIC_D1_ID,
      outputDir
    });
    const generated = JSON.parse(await readFile(generatedConfigPath, 'utf8'));
    const redirect = JSON.parse(await readFile(redirectPath, 'utf8'));

    assert.equal(generated.name, 'streamarkr-api');
    assert.deepEqual(generated.assets, {
      directory: '../site',
      not_found_handling: 'single-page-application',
      run_worker_first: ['/api/*']
    });
    assert.equal(generated.d1_databases[0].database_id, SYNTHETIC_D1_ID);
    assert.deepEqual(redirect, { configPath: './wrangler.generated.jsonc' });
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});


test('stages only deployable PWA assets for same-origin Worker hosting', async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'streamarkr-worker-assets-'));
  try {
    await prepareWorkerAssets({ projectRoot: PROJECT_ROOT, outputDir });
    await assertWorkerAssetBundle(outputDir);
    await stat(path.join(outputDir, 'public', 'icons', 'icon-192.png'));
    await assert.rejects(readFile(path.join(outputDir, 'package.json'), 'utf8'), { code: 'ENOENT' });
    await assert.rejects(readFile(path.join(outputDir, 'docs', 'STREAMARKR_STATE.md'), 'utf8'), { code: 'ENOENT' });
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});
