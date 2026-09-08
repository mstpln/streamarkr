import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BackendRequestError, WorkerBackendClient } from '../src/lib/backend-client.js';

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

test('backend request failures expose only status and known backend error codes', async () => {
  const client = new WorkerBackendClient('https://worker.example', null, async () =>
    jsonResponse({ error: 'unauthorized' }, 401));

  await assert.rejects(
    () => client.getSessionStatus(),
    (error: unknown) => error instanceof BackendRequestError && error.status === 401 && error.code === 'unauthorized'
  );
});

test('backend request failures discard arbitrary response text instead of treating it as a diagnostic code', async () => {
  const client = new WorkerBackendClient('https://worker.example', null, async () =>
    jsonResponse({ error: 'Bearer super-secret-token', message: 'also secret' }, 500));

  await assert.rejects(
    () => client.getSessionStatus(),
    (error: unknown) => error instanceof BackendRequestError && error.status === 500 && error.code === null && !error.message.includes('secret')
  );
});

test('backend request failures discard unknown code-shaped response values', async () => {
  const client = new WorkerBackendClient('https://worker.example', null, async () =>
    jsonResponse({ error: 'private_runtime_detail' }, 500));

  await assert.rejects(
    () => client.getSessionStatus(),
    (error: unknown) => error instanceof BackendRequestError && error.status === 500 && error.code === null && !error.message.includes('private_runtime_detail')
  );
});

test('bootstrap sends the device token only in the one JSON exchange body and never as Authorization', async () => {
  const seen: Array<{ auth: string | null; contentType: string | null; credentials: RequestCredentials | undefined; method: string; body: string | null }> = [];
  const client = new WorkerBackendClient('https://worker.example', null, async (_input, init) => {
    seen.push({
      auth: new Headers(init?.headers).get('authorization'),
      contentType: new Headers(init?.headers).get('content-type'),
      credentials: init?.credentials,
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? init.body : null
    });
    if (init?.method === 'POST') return jsonResponse({ ok: true, expiresAt: '2026-10-08T00:00:00.000Z' });
    return new Response(null, { status: 204 });
  });

  const session = await client.bootstrapSession('one-time-browser-entry');
  await client.clearSession();

  assert.deepEqual(session, { expiresAt: '2026-10-08T00:00:00.000Z' });
  assert.deepEqual(seen, [
    {
      auth: null,
      contentType: 'application/json',
      credentials: 'include',
      method: 'POST',
      body: JSON.stringify({ deviceAccessToken: 'one-time-browser-entry' })
    },
    { auth: null, contentType: null, credentials: 'include', method: 'DELETE', body: null }
  ]);
});

test('local-state migration uses the browser session cookie and never re-sends the device token', async () => {
  const seen: Array<{ url: string; auth: string | null; credentials: RequestCredentials | undefined; method: string; body: string | null }> = [];
  const client = new WorkerBackendClient('https://worker.example', null, async (input, init) => {
    seen.push({
      url: String(input),
      auth: new Headers(init?.headers).get('authorization'),
      credentials: init?.credentials,
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? init.body : null
    });
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

  assert.deepEqual(seen, [{
    url: 'https://worker.example/api/migration/local-state',
    auth: null,
    credentials: 'include',
    method: 'POST',
    body: JSON.stringify(bundle)
  }]);
});
