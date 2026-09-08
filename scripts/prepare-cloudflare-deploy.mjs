import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(MODULE_DIR, '..');
const DEFAULT_OUTPUT_DIR = path.join(PROJECT_ROOT, '.wrangler', 'deploy');
const DATABASE_ID_ENV = 'STREAMARKR_D1_DATABASE_ID';

export function validateD1DatabaseId(value) {
  const id = String(value ?? '').trim();
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(id) || id === '00000000-0000-0000-0000-000000000000') {
    throw new Error(`${DATABASE_ID_ENV} must be the dedicated Streamarkr D1 database UUID.`);
  }
  return id;
}

export function buildRemoteConfig(databaseId) {
  const id = validateD1DatabaseId(databaseId);
  return {
    $schema: '../../node_modules/wrangler/config-schema.json',
    name: 'streamarkr-api',
    main: '../../worker/index.ts',
    compatibility_date: '2026-09-07',
    keep_vars: true,
    secrets: {
      required: ['DEVICE_ACCESS_TOKEN']
    },
    assets: {
      directory: '../site',
      not_found_handling: 'single-page-application',
      run_worker_first: ['/api/*']
    },
    d1_databases: [
      {
        binding: 'DB',
        database_name: 'streamarkr',
        database_id: id,
        migrations_dir: '../../migrations'
      }
    ]
  };
}

export async function prepareCloudflareDeploy({ databaseId = process.env[DATABASE_ID_ENV], outputDir = DEFAULT_OUTPUT_DIR } = {}) {
  const config = buildRemoteConfig(databaseId);
  await mkdir(outputDir, { recursive: true });

  const generatedConfigPath = path.join(outputDir, 'wrangler.generated.jsonc');
  const redirectPath = path.join(outputDir, 'config.json');
  await writeFile(generatedConfigPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await writeFile(redirectPath, `${JSON.stringify({ configPath: './wrangler.generated.jsonc' })}\n`, { mode: 0o600 });

  return { generatedConfigPath, redirectPath };
}

const invokedAsScript = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (invokedAsScript) {
  try {
    await prepareCloudflareDeploy();
    console.log('Prepared guarded Streamarkr Cloudflare deploy configuration.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Failed to prepare Cloudflare deploy configuration.');
    process.exitCode = 1;
  }
}
