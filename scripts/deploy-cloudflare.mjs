import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { prepareCloudflareDeploy } from './prepare-cloudflare-deploy.mjs';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(MODULE_DIR, '..');
const WRANGLER_BIN = process.platform === 'win32'
  ? path.join(PROJECT_ROOT, 'node_modules', '.bin', 'wrangler.cmd')
  : path.join(PROJECT_ROOT, 'node_modules', '.bin', 'wrangler');
const CONFIG_PATH = path.join(PROJECT_ROOT, '.wrangler', 'deploy', 'wrangler.generated.jsonc');
const SAFETY_FLAGS = ['--x-provision=false', '--x-auto-create=false'];

export function assertRequiredSecretNames(secretList) {
  if (!Array.isArray(secretList)) throw new Error('Could not verify Streamarkr Worker secrets.');
  const names = new Set(secretList.map((item) => item && typeof item === 'object' ? item.name : undefined));
  if (!names.has('DEVICE_ACCESS_TOKEN')) {
    throw new Error('DEVICE_ACCESS_TOKEN is not configured on streamarkr-api; refusing to migrate or deploy.');
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
  await prepareCloudflareDeploy();

  const secretOutput = runWrangler([
    'secret', 'list',
    '--config', CONFIG_PATH,
    '--format', 'json',
    ...SAFETY_FLAGS
  ], { capture: true });

  let secretList;
  try {
    secretList = JSON.parse(secretOutput);
  } catch {
    throw new Error('Could not parse Streamarkr Worker secret metadata; refusing to migrate or deploy.');
  }
  assertRequiredSecretNames(secretList);

  runWrangler([
    'd1', 'migrations', 'apply', 'DB',
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
