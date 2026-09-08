import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const PORT = 8791;
const BASE_URL = `http://localhost:${PORT}`;
const QA_DIR = path.resolve('.wrangler', 'auth-qa');
const CONFIG_PATH = path.join(QA_DIR, 'wrangler.jsonc');
const TOKEN = 'synthetic-browser-auth-qa-token';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(processRef) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (processRef.exitCode !== null) throw new Error(`Wrangler exited before startup with code ${processRef.exitCode}.`);
    try {
      const response = await fetch(`${BASE_URL}/`);
      if (response.ok) return;
    } catch {
      // Keep waiting while Wrangler starts.
    }
    await wait(250);
  }
  throw new Error('Timed out waiting for the local same-origin Worker.');
}

async function main() {
  await rm(QA_DIR, { recursive: true, force: true });
  await mkdir(QA_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, `${JSON.stringify({
    $schema: '../../node_modules/wrangler/config-schema.json',
    name: 'streamarkr-auth-qa',
    main: '../../worker/index.ts',
    compatibility_date: '2026-09-07',
    vars: {
      APP_ENV: 'qa',
      APP_ORIGIN: 'https://deliberately-stale.example',
      DEVICE_ACCESS_TOKEN: `  ${TOKEN}\n`
    },
    assets: {
      directory: '../site',
      not_found_handling: 'single-page-application',
      run_worker_first: ['/api/*']
    }
  }, null, 2)}\n`);

  const wrangler = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['wrangler', 'dev', '--config', CONFIG_PATH, '--local', '--port', String(PORT)],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );
  let logs = '';
  wrangler.stdout.on('data', (chunk) => { logs += chunk.toString(); });
  wrangler.stderr.on('data', (chunk) => { logs += chunk.toString(); });

  let browser;
  try {
    await waitForServer(wrangler);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    const bootstrap = await page.evaluate(async (token) => {
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deviceAccessToken: token })
      });
      return { status: response.status, body: await response.json() };
    }, TOKEN);
    if (bootstrap.status !== 200 || bootstrap.body?.ok !== true) {
      throw new Error(`Same-origin browser bootstrap failed with HTTP ${bootstrap.status}.`);
    }
    console.log('PASS — actual Wrangler Worker accepts same-origin browser bootstrap with stale APP_ORIGIN and padded runtime secret');

    const session = await page.evaluate(async () => {
      const response = await fetch('/api/auth/session', { credentials: 'include' });
      return { status: response.status, body: await response.json() };
    });
    if (session.status !== 200 || session.body?.authenticated !== true || session.body?.method !== 'browser-session') {
      throw new Error(`Secure browser cookie was not retained/verified by the actual Worker (HTTP ${session.status}).`);
    }
    console.log('PASS — Chromium retains and reuses the Worker-issued secure HttpOnly browser session cookie');

    const wrongToken = await page.evaluate(async () => {
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deviceAccessToken: 'synthetic-wrong-token' })
      });
      return { status: response.status, body: await response.json() };
    });
    if (wrongToken.status !== 401 || wrongToken.body?.error !== 'unauthorized') {
      throw new Error(`Wrong-token browser bootstrap did not fail closed (HTTP ${wrongToken.status}).`);
    }
    console.log('PASS — actual Worker rejects a wrong browser token with controlled 401 unauthorized');

    const crossOrigin = await fetch(`${BASE_URL}/api/auth/session`, {
      method: 'POST',
      headers: {
        origin: 'https://foreign.example',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ deviceAccessToken: TOKEN })
    });
    const crossOriginBody = await crossOrigin.json();
    if (crossOrigin.status !== 403 || crossOriginBody?.error !== 'origin_not_allowed') {
      throw new Error(`Cross-origin bootstrap did not fail closed (HTTP ${crossOrigin.status}).`);
    }
    console.log('PASS — actual Worker rejects a foreign browser origin even with the correct token');

    console.log('4/4 same-origin Worker authentication topology checks passed.');
  } finally {
    if (browser) await browser.close();
    if (wrangler.exitCode === null) wrangler.kill('SIGTERM');
    await Promise.race([new Promise((resolve) => wrangler.once('exit', resolve)), wait(2000)]);
    if (process.exitCode) process.stderr.write(logs);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
