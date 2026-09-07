import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildRemoteConfig,
  prepareCloudflareDeploy,
  validateD1DatabaseId
} from '../scripts/prepare-cloudflare-deploy.mjs';

const SYNTHETIC_D1_ID = '12345678-1234-4234-8234-123456789abc';

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
  assert.deepEqual(config.d1_databases, [{
    binding: 'DB',
    database_name: 'streamarkr',
    database_id: SYNTHETIC_D1_ID,
    migrations_dir: '../../migrations'
  }]);
  assert.doesNotMatch(JSON.stringify(config), /bandmarkr/i);
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
    assert.equal(generated.d1_databases[0].database_id, SYNTHETIC_D1_ID);
    assert.deepEqual(redirect, { configPath: './wrangler.generated.jsonc' });
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});
