import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorkerBackendClient } from '../src/lib/backend-client.js';

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

test('cookie-mode backend client includes credentials without persisting a bearer token in requests', async () => {
  const seen: Array<{ url: string; auth: string | null; credentials: RequestCredentials | undefined; method: string }> = [];
  const client = new WorkerBackendClient('https://worker.example', null, async (input, init) => {
    seen.push({
      url: String(input),
      auth: new Headers(init?.headers).get('authorization'),
      credentials: init?.credentials,
      method: init?.method ?? 'GET'
    });
    return jsonResponse({ authenticated: true, method: 'browser-session' });
  });

  const status = await client.getSessionStatus();
  assert.deepEqual(status, { authenticated: true, method: 'browser-session' });
  assert.deepEqual(seen, [{
    url: 'https://worker.example/api/auth/session',
    auth: null,
    credentials: 'include',
    method: 'GET'
  }]);
});

test('bootstrap sends the device token only on the one exchange request and logout uses cookies', async () => {
  const seen: Array<{ auth: string | null; credentials: RequestCredentials | undefined; method: string }> = [];
  const client = new WorkerBackendClient('https://worker.example', null, async (_input, init) => {
    seen.push({
      auth: new Headers(init?.headers).get('authorization'),
      credentials: init?.credentials,
      method: init?.method ?? 'GET'
    });
    if (init?.method === 'POST') return jsonResponse({ ok: true, expiresAt: '2026-10-08T00:00:00.000Z' });
    return new Response(null, { status: 204 });
  });

  const session = await client.bootstrapSession('one-time-browser-entry');
  await client.clearSession();

  assert.deepEqual(session, { expiresAt: '2026-10-08T00:00:00.000Z' });
  assert.deepEqual(seen, [
    { auth: 'Bearer one-time-browser-entry', credentials: 'include', method: 'POST' },
    { auth: null, credentials: 'include', method: 'DELETE' }
  ]);
});

test('local-state migration uses the browser session cookie and never re-sends the device token', async () => {
  let seen: { url: string; auth: string | null; credentials: RequestCredentials | undefined; method: string; body: string | null } | null = null;
  const client = new WorkerBackendClient('https://worker.example', null, async (input, init) => {
    seen = {
      url: String(input),
      auth: new Headers(init?.headers).get('authorization'),
      credentials: init?.credentials,
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? init.body : null
    };
    return jsonResponse({ ok: true, alreadyApplied: false });
  });
  const bundle = {
    migrationId: '11111111-1111-4111-8111-111111111111',
    snapshot: {
      schemaVersion: 1,
      generatedAt: '2026-09-08T10:00:00.000Z',
      titles: [], metadata: [], seasons: [], episodes: [], watchEvents: [], watchOverrides: [],
      library: [], ratings: [], watchedService: [], services: [], availability: [], alerts: [], syncState: []
    }
  };

  await client.importLocalState(bundle);

  assert.equal(seen?.url, 'https://worker.example/api/migration/local-state');
  assert.equal(seen?.auth, null);
  assert.equal(seen?.credentials, 'include');
  assert.equal(seen?.method, 'POST');
  assert.equal(seen?.body, JSON.stringify(bundle));
});
