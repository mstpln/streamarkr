import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAuthorized } from '../worker/auth.js';

test('worker auth accepts the exact bearer token', async () => {
  const request = new Request('https://streamarkr.example/api/snapshot', { headers: { authorization: 'Bearer synthetic-test-token' } });
  assert.equal(await isAuthorized(request, 'synthetic-test-token'), true);
});

test('worker auth rejects missing, malformed and incorrect tokens', async () => {
  assert.equal(await isAuthorized(new Request('https://streamarkr.example/api/snapshot'), 'expected'), false);
  assert.equal(await isAuthorized(new Request('https://streamarkr.example/api/snapshot', { headers: { authorization: 'Basic abc' } }), 'expected'), false);
  assert.equal(await isAuthorized(new Request('https://streamarkr.example/api/snapshot', { headers: { authorization: 'Bearer wrong' } }), 'expected'), false);
});
