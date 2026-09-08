import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleRequest } from '../worker/index.js';
import type { D1Database, D1PreparedStatement, D1Result, Env } from '../worker/types.js';

class UnusedDb implements D1Database {
  prepare(_query: string): D1PreparedStatement { throw new Error('D1 must not be touched by browser auth tests'); }
  async batch<T>(_statements: D1PreparedStatement[]): Promise<D1Result<T>[]> { throw new Error('D1 must not be touched by browser auth tests'); }
  async exec(_query: string): Promise<{ count: number; duration: number }> { throw new Error('D1 must not be touched by browser auth tests'); }
}

function env(overrides: Partial<Env> = {}): Env {
  return {
    DB: new UnusedDb(),
    DEVICE_ACCESS_TOKEN: 'synthetic-device-token',
    APP_ORIGIN: 'https://stale-config.example',
    APP_ENV: 'qa',
    ...overrides
  };
}

function bootstrapRequest(origin = 'https://worker.example', token = 'synthetic-device-token'): Request {
  return new Request('https://worker.example/api/auth/session', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ deviceAccessToken: token })
  });
}

test('browser bootstrap exchanges the device token for an HttpOnly signed session cookie on the serving origin', async () => {
  const response = await handleRequest(bootstrapRequest(), env());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://worker.example');
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  const setCookie = response.headers.get('set-cookie') ?? '';
  assert.match(setCookie, /^__Host-streamarkr_session=/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /Secure/i);
  assert.match(setCookie, /SameSite=None/i);
  assert.equal(setCookie.includes('synthetic-device-token'), false);
  const payload = await response.json() as { ok: boolean; expiresAt: string };
  assert.equal(payload.ok, true);
  assert.match(payload.expiresAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('browser bootstrap ignores stale APP_ORIGIN and uses the actual serving origin', async () => {
  const response = await handleRequest(bootstrapRequest(), env({ APP_ORIGIN: 'https://obsolete.example' }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://worker.example');

  const staleConfiguredOrigin = await handleRequest(bootstrapRequest('https://obsolete.example'), env({ APP_ORIGIN: 'https://obsolete.example' }));
  assert.equal(staleConfiguredOrigin.status, 403);
  assert.equal((await staleConfiguredOrigin.json() as { error: string }).error, 'origin_not_allowed');
});

test('browser bootstrap remains compatible with an older cached client using Authorization', async () => {
  const response = await handleRequest(new Request('https://worker.example/api/auth/session', {
    method: 'POST',
    headers: { origin: 'https://worker.example', authorization: 'Bearer synthetic-device-token' }
  }), env());
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie') ?? '', /^__Host-streamarkr_session=/);

  const badToken = await handleRequest(new Request('https://worker.example/api/auth/session', {
    method: 'POST',
    headers: { origin: 'https://worker.example', authorization: 'Bearer wrong-token' }
  }), env());
  assert.equal(badToken.status, 401);

  const wrongOrigin = await handleRequest(new Request('https://worker.example/api/auth/session', {
    method: 'POST',
    headers: { origin: 'https://evil.example', authorization: 'Bearer synthetic-device-token' }
  }), env());
  assert.equal(wrongOrigin.status, 403);
  assert.equal((await wrongOrigin.json() as { error: string }).error, 'origin_not_allowed');
});

test('browser bootstrap tolerates copied surrounding whitespace without changing the configured secret', async () => {
  const response = await handleRequest(bootstrapRequest('https://worker.example', '  synthetic-device-token\n'), env());
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie') ?? '', /^__Host-streamarkr_session=/);
});

test('the signed browser cookie authenticates only from the serving origin', async () => {
  const bootstrap = await handleRequest(bootstrapRequest(), env());
  const cookie = (bootstrap.headers.get('set-cookie') ?? '').split(';')[0];

  const accepted = await handleRequest(new Request('https://worker.example/api/auth/session', {
    headers: { origin: 'https://worker.example', cookie }
  }), env());
  assert.equal(accepted.status, 200);
  assert.deepEqual(await accepted.json(), { authenticated: true, method: 'browser-session' });

  const wrongOrigin = await handleRequest(new Request('https://worker.example/api/auth/session', {
    headers: { origin: 'https://evil.example', cookie }
  }), env());
  assert.equal(wrongOrigin.status, 403);
  assert.equal((await wrongOrigin.json() as { error: string }).error, 'origin_not_allowed');

  const missingOrigin = await handleRequest(new Request('https://worker.example/api/auth/session', {
    headers: { cookie }
  }), env());
  assert.equal(missingOrigin.status, 200);
  assert.deepEqual(await missingOrigin.json(), { authenticated: true, method: 'browser-session' });
});

test('tampering with a browser session cookie invalidates it', async () => {
  const bootstrap = await handleRequest(bootstrapRequest(), env());
  const cookie = (bootstrap.headers.get('set-cookie') ?? '').split(';')[0];
  const [name, value] = cookie.split('=');
  const parts = value.split('.');
  assert.equal(parts.length, 3);
  const signature = parts[2];
  parts[2] = `${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`;
  const tampered = `${name}=${parts.join('.')}`;
  const response = await handleRequest(new Request('https://worker.example/api/auth/session', {
    headers: { origin: 'https://worker.example', cookie: tampered }
  }), env());
  assert.equal(response.status, 401);
});

test('browser bootstrap fails closed for a cross-origin request or bad token', async () => {
  const mismatch = await handleRequest(bootstrapRequest('https://evil.example'), env());
  assert.equal(mismatch.status, 403);
  assert.equal((await mismatch.json() as { error: string }).error, 'origin_not_allowed');

  const badToken = await handleRequest(bootstrapRequest('https://worker.example', 'wrong'), env());
  assert.equal(badToken.status, 401);
});

test('browser bootstrap rejects missing or malformed token bodies without touching D1', async () => {
  const missing = await handleRequest(new Request('https://worker.example/api/auth/session', {
    method: 'POST', headers: { origin: 'https://worker.example', 'content-type': 'application/json' }, body: '{}'
  }), env());
  assert.equal(missing.status, 401);

  const malformed = await handleRequest(new Request('https://worker.example/api/auth/session', {
    method: 'POST', headers: { origin: 'https://worker.example', 'content-type': 'application/json' }, body: '{'
  }), env());
  assert.equal(malformed.status, 401);
});

test('logout clears the browser session cookie without exposing or requiring the device token', async () => {
  const response = await handleRequest(new Request('https://worker.example/api/auth/session', {
    method: 'DELETE', headers: { origin: 'https://worker.example' }
  }), env());
  assert.equal(response.status, 204);
  const setCookie = response.headers.get('set-cookie') ?? '';
  assert.match(setCookie, /^__Host-streamarkr_session=;/);
  assert.match(setCookie, /Max-Age=0/i);
});

test('legacy bearer authentication remains available for non-browser operational clients', async () => {
  const response = await handleRequest(new Request('https://worker.example/api/auth/session', {
    headers: { authorization: 'Bearer synthetic-device-token' }
  }), env());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { authenticated: true, method: 'device-token' });
});

test('credentialed CORS preflight is limited to the actual serving origin', async () => {
  const allowed = await handleRequest(new Request('https://worker.example/api/snapshot', {
    method: 'OPTIONS', headers: { origin: 'https://worker.example' }
  }), env());
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('access-control-allow-credentials'), 'true');

  const denied = await handleRequest(new Request('https://worker.example/api/snapshot', {
    method: 'OPTIONS', headers: { origin: 'https://evil.example' }
  }), env());
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
});
