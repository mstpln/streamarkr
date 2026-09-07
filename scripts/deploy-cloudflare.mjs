import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { prepareCloudflareDeploy, validateD1DatabaseId } from './prepare-cloudflare-deploy.mjs';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(MODULE_DIR, '..');
const WRANGLER_BIN = process.platform === 'win32'
  ? path.join(PROJECT_ROOT, 'node_modules', '.bin', 'wrangler.cmd')
  : path.join(PROJECT_ROOT, 'node_modules', '.bin', 'wrangler');
const ACCOUNT_NEUTRAL_CONFIG_PATH = path.join(PROJECT_ROOT, 'wrangler.jsonc');
const CONFIG_PATH = path.join(PROJECT_ROOT, '.wrangler', 'deploy', 'wrangler.generated.jsonc');
const SAFETY_FLAGS = ['--x-provision=false', '--x-auto-create=false'];
const EXPECTED_D1_NAME = 'streamarkr';
const EXPECTED_D1_JURISDICTION = 'eu';

export function assertRequiredSecretNames(secretList) {
  if (!Array.isArray(secretList)) throw new Error('Could not verify Streamarkr Worker secrets.');
  const names = new Set(secretList.map((item) => item && typeof item === 'object' ? item.name : undefined));
  if (!names.has('DEVICE_ACCESS_TOKEN')) {
    throw new Error('DEVICE_ACCESS_TOKEN is not configured on streamarkr-api; refusing to migrate or deploy.');
  }
}

export function assertDedicatedD1Info(databaseInfo, expectedDatabaseId) {
  if (!databaseInfo || typeof databaseInfo !== 'object' || Array.isArray(databaseInfo)) {
    throw new Error('Could not verify the dedicated Streamarkr D1 database; refusing to migrate or deploy.');
  }

  const expectedId = validateD1DatabaseId(expectedDatabaseId).toLowerCase();
  const actualId = typeof databaseInfo.uuid === 'string' ? databaseInfo.uuid.toLowerCase() : '';
  const actualName = typeof databaseInfo.name === 'string' ? databaseInfo.name : '';
  const actualJurisdiction = typeof databaseInfo.jurisdiction === 'string' ? databaseInfo.jurisdiction.toLowerCase() : '';

  if (actualName !== EXPECTED_D1_NAME || actualId !== expectedId || actualJurisdiction !== EXPECTED_D1_JURISDICTION) {
    throw new Error('Remote D1 identity does not match the dedicated EU Streamarkr database; refusing to migrate or deploy.');
  }
}

function parseJsonMetadata(output, label) {
  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`Could not parse ${label}; refusing to migrate or deploy.`);
  }
}

function runWrangler(args, { capture = false } = {}) {
  const result = spawnSync(WRANGLER_BIN, args, {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit'
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = capture ? String(result.stderr || '').trim() : '';
    throw new Error(detail || `Wrangler command failed: ${args.slice(0, 3).join(' ')}`);
  }
  return capture ? String(result.stdout || '') : '';
}

export async function deployCloudflare() {
  const databaseId = validateD1DatabaseId(process.env.STREAMARKR_D1_DATABASE_ID);
  await prepareCloudflareDeploy({ databaseId });

  // Query by literal database name using the account-neutral config, which deliberately contains
  // no D1 binding. This forces Wrangler to resolve `streamarkr` from the authenticated account
  // instead of trusting the build-supplied UUID. No D1 mutation is attempted until both match.
  const databaseOutput = runWrangler([
    'd1', 'info', EXPECTED_D1_NAME,
    '--json',
    '--config', ACCOUNT_NEUTRAL_CONFIG_PATH,
    ...SAFETY_FLAGS
  ], { capture: true });
  assertDedicatedD1Info(parseJsonMetadata(databaseOutput, 'Streamarkr D1 metadata'), databaseId);

  const secretOutput = runWrangler([
    'secret', 'list',
    '--config', CONFIG_PATH,
    '--format', 'json',
    ...SAFETY_FLAGS
  ], { capture: true });
  assertRequiredSecretNames(parseJsonMetadata(secretOutput, 'Streamarkr Worker secret metadata'));

  runWrangler([
    'd1', 'migrations', 'apply', EXPECTED_D1_NAME,
    '--remote', '--yes',
    '--config', CONFIG_PATH,
    ...SAFETY_FLAGS
  ]);

  runWrangler([
    'deploy',
    '--config', CONFIG_PATH,
    ...SAFETY_FLAGS
  ]);
}

const invokedAsScript = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (invokedAsScript) {
  try {
    await deployCloudflare();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Cloudflare deployment failed.');
    process.exitCode = 1;
  }
}
