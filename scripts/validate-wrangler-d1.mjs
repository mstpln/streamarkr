import { rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const WRANGLER_VERSION = '4.129.0';
const WRANGLER_BIN = process.platform === 'win32'
  ? 'node_modules/.bin/wrangler.cmd'
  : 'node_modules/.bin/wrangler';
const CONFIG = 'wrangler.local.jsonc';
const DATABASE = 'streamarkr-local';
const PERSIST_DIR = '.wrangler/test-d1';

function runWrangler(args, { json = false } = {}) {
  const result = spawnSync(
    WRANGLER_BIN,
    [
      ...args,
      '--config', CONFIG,
      '--x-provision=false',
      '--x-auto-create=false'
    ],
    {
      encoding: 'utf8',
      env: { ...process.env, CI: '1', NO_D1_WARNING: 'true' }
    }
  );

  if (result.error) {
    throw new Error(`Unable to launch the repository-pinned Wrangler binary: ${result.error.message}`);
  }

  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    throw new Error(`Wrangler command failed with exit code ${result.status ?? 'unknown'}`);
  }

  if (!json) return result.stdout;

  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    process.stderr.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    throw new Error(`Wrangler did not return valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function findRows(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const rows = findRows(item);
      if (rows) return rows;
    }
    return null;
  }

  if (value && typeof value === 'object') {
    if (Array.isArray(value.results)) return value.results;
    for (const child of Object.values(value)) {
      const rows = findRows(child);
      if (rows) return rows;
    }
  }

  return null;
}

const versionOutput = spawnSync(WRANGLER_BIN, ['--version'], { encoding: 'utf8' });
if (versionOutput.error || versionOutput.status !== 0) {
  throw new Error('Repository-pinned Wrangler is unavailable; run npm ci before validation');
}
if (!versionOutput.stdout.includes(WRANGLER_VERSION)) {
  throw new Error(`Expected Wrangler ${WRANGLER_VERSION}, received ${versionOutput.stdout.trim() || 'unknown'}`);
}

rmSync(PERSIST_DIR, { recursive: true, force: true });

runWrangler([
  'd1', 'migrations', 'apply', DATABASE,
  '--local',
  '--persist-to', PERSIST_DIR
]);

const query = `
SELECT
  (SELECT value FROM app_meta WHERE key = 'schema_version') AS schema_version,
  (SELECT COUNT(*) FROM services) AS service_count,
  (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'titles') AS titles_table_count,
  (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'd1_migrations') AS migrations_table_count;
`.trim();

const output = runWrangler([
  'd1', 'execute', DATABASE,
  '--local',
  '--persist-to', PERSIST_DIR,
  '--command', query,
  '--json'
], { json: true });

const rows = findRows(output);
if (!rows || rows.length !== 1) {
  throw new Error(`Expected one Wrangler D1 verification row, received ${rows?.length ?? 0}`);
}

const row = rows[0];
if (String(row.schema_version) !== '1') {
  throw new Error(`Expected schema_version 1, received ${row.schema_version}`);
}
if (Number(row.service_count) !== 8) {
  throw new Error(`Expected 8 seeded services, received ${row.service_count}`);
}
if (Number(row.titles_table_count) !== 1) {
  throw new Error('Expected titles table to exist after migration');
}
if (Number(row.migrations_table_count) !== 1) {
  throw new Error('Expected Wrangler d1_migrations table to exist after migration');
}

console.log(`Wrangler ${WRANGLER_VERSION} local D1 migration validation passed.`);
console.log('schema_version=1, services=8, titles table present, migration history present');
