import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createAppServer } from '../server.mjs';

async function fixture(t) {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'streamarkr-static-'));
  const root = path.join(temp, 'app');
  const files = {
    'index.html': '<h1>Streamarkr</h1>',
    'manifest.webmanifest': '{}',
    'sw.js': '// service worker',
    'sw-manifest.json': '{"files":[]}',
    'src/styles/main.css': 'body {}',
    'dist/main.js': '// entry',
    'dist/lib/repo.js': '// repository',
    'public/icons/icon-192.png': 'synthetic image',
    '.git/config': 'PRIVATE_FIXTURE',
    '.env': 'PRIVATE_FIXTURE',
    '.dev.vars': 'PRIVATE_FIXTURE',
    'README.md': 'PRIVATE_FIXTURE',
    'src/main.ts': 'PRIVATE_FIXTURE'
  };
  for (const [name, data] of Object.entries(files)) {
    const target = path.join(root, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
  }
  const server = createAppServer({ projectRoot: root });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(temp, { recursive: true, force: true });
  });
  // http.request preserves raw encoded traversal instead of normalizing it as fetch would.
  const request = (pathname, method = 'GET') => new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: pathname, method }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
  return { root, temp, request };
}

test('static preview serves the PWA shell, compiled modules and public icons', async (t) => {
  const { request } = await fixture(t);
  for (const url of ['/', '/index.html?version=1', '/manifest.webmanifest', '/sw.js',
    '/sw-manifest.json', '/src/styles/main.css', '/dist/main.js',
    '/dist/lib/repo.js', '/public/icons/icon-192.png']) {
    assert.equal((await request(url)).status, 200, url);
  }
  assert.match((await request('/dist/main.js')).headers['content-type'], /javascript/);
  const head = await request('/', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
});

test('static preview refuses private repository files and unsupported methods', async (t) => {
  const { request } = await fixture(t);
  for (const url of ['/.git/config', '/.env', '/.dev.vars', '/README.md',
    '/src/main.ts', '/package.json', '/server.mjs', '/dist/.env', '/public/.env',
    '/dist/main.js.map', '/api/auth/session']) {
    const response = await request(url);
    assert.equal(response.status, 403, url);
    assert.ok(!response.body.includes('PRIVATE_FIXTURE'));
  }
  assert.equal((await request('/', 'POST')).status, 405);
  assert.equal((await request('/dist/missing.js')).status, 404);
});

test('static preview rejects encoded traversal, backslashes and malformed paths without crashing', async (t) => {
  const { request } = await fixture(t);
  for (const url of ['/dist/../../.env', '/dist/%2e%2e/.env', '/dist/%2e%2e%2f.env',
    '/dist/..%5c.env', '/dist/main.js%00', '/dist//main.js', '/%2egit/config']) {
    assert.equal((await request(url)).status, 403, url);
  }
  assert.equal((await request('/dist/%ZZ.js')).status, 400);
  assert.equal((await request('/')).status, 200);
});

test('static preview rejects symlinks to private files and sibling-root prefix collisions', async (t) => {
  const { request, root, temp } = await fixture(t);
  await symlink(path.join(root, '.env'), path.join(root, 'public/private.png'));
  const sibling = path.join(temp, 'app-private');
  await mkdir(sibling);
  await writeFile(path.join(sibling, 'secret.png'), 'PRIVATE_FIXTURE');
  await symlink(path.join(sibling, 'secret.png'), path.join(root, 'public/outside.png'));
  assert.equal((await request('/public/private.png')).status, 403);
  assert.equal((await request('/public/outside.png')).status, 403);
});
