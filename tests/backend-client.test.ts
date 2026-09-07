import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorkerBackendClient } from '../src/lib/backend-client.js';

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

test('WorkerBackendClient sends bearer auth and URL-encodes title ids', async () => {
  let seenUrl = '';
  let seenAuth = '';
  let seenMethod = '';
  const client = new WorkerBackendClient('https://worker.example/', 'synthetic-token', async (input, init) => {
    seenUrl = String(input);
    seenAuth = new Headers(init?.headers).get('authorization') ?? '';
    seenMethod = init?.method ?? 'GET';
    return jsonResponse({ ok: true });
  });
  await client.addToLibrary('series/with space');
  assert.equal(seenUrl, 'https://worker.example/api/library/series%2Fwith%20space');
  assert.equal(seenAuth, 'Bearer synthetic-token');
  assert.equal(seenMethod, 'PUT');
});

test('WorkerBackendClient sends JSON rating payloads', async () => {
  let body = '';
  let contentType = '';
  const client = new WorkerBackendClient('https://worker.example', 'synthetic-token', async (_input, init) => {
    body = String(init?.body ?? '');
    contentType = new Headers(init?.headers).get('content-type') ?? '';
    return jsonResponse({ ok: true });
  });
  await client.setRating('movie-1', 5);
  assert.equal(body, JSON.stringify({ stars: 5 }));
  assert.equal(contentType, 'application/json');
});

test('WorkerBackendClient surfaces backend failures without exposing credentials', async () => {
  const client = new WorkerBackendClient('https://worker.example', 'super-secret', async () => jsonResponse({ error: 'unauthorized' }, 401));
  await assert.rejects(() => client.getSnapshot(), (error: Error) => {
    assert.match(error.message, /401/);
    assert.match(error.message, /unauthorized/);
    assert.equal(error.message.includes('super-secret'), false);
    return true;
  });
});
