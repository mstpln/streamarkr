import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BROWSER_SESSION_TTL_SECONDS,
  createBrowserSession,
  isAuthorized,
  isBrowserSessionAuthorized
} from '../worker/auth.js';

test('worker auth accepts the exact bearer token', async () => {
  const request = new Request('https://streamarkr.example/api/snapshot', { headers: { authorization: 'Bearer synthetic-test-token' } });
  assert.equal(await isAuthorized(request, 'synthetic-test-token'), true);
});

test('worker auth rejects missing, malformed and incorrect tokens', async () => {
  assert.equal(await isAuthorized(new Request('https://streamarkr.example/api/snapshot'), 'expected'), false);
  assert.equal(await isAuthorized(new Request('https://streamarkr.example/api/snapshot', { headers: { authorization: 'Basic abc' } }), 'expected'), false);
  assert.equal(await isAuthorized(new Request('https://streamarkr.example/api/snapshot', { headers: { authorization: 'Bearer wrong' } }), 'expected'), false);
});

test('signed browser sessions expire at the configured TTL boundary', async () => {
  const issuedAt = Date.UTC(2026, 8, 8, 9, 0, 0);
  const session = await createBrowserSession('synthetic-session-key', issuedAt);
  const request = new Request('https://streamarkr.example/api/snapshot', {
    headers: { cookie: `__Host-streamarkr_session=${session.token}` }
  });

  assert.equal(await isBrowserSessionAuthorized(request, 'synthetic-session-key', issuedAt + (BROWSER_SESSION_TTL_SECONDS * 1000) - 1), true);
  assert.equal(await isBrowserSessionAuthorized(request, 'synthetic-session-key', issuedAt + (BROWSER_SESSION_TTL_SECONDS * 1000)), false);
});

test('rotating the device secret immediately invalidates previously signed browser sessions', async () => {
  const issuedAt = Date.UTC(2026, 8, 8, 9, 0, 0);
  const session = await createBrowserSession('old-synthetic-session-key', issuedAt);
  const request = new Request('https://streamarkr.example/api/snapshot', {
    headers: { cookie: `__Host-streamarkr_session=${session.token}` }
  });

  assert.equal(await isBrowserSessionAuthorized(request, 'old-synthetic-session-key', issuedAt + 1000), true);
  assert.equal(await isBrowserSessionAuthorized(request, 'rotated-synthetic-session-key', issuedAt + 1000), false);
});
