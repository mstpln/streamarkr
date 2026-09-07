import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleRequest } from '../worker/index.js';
import type { D1Database, D1PreparedStatement, D1Primitive, D1Result, Env } from '../worker/types.js';

class Statement implements D1PreparedStatement {
  values: D1Primitive[] = [];
  constructor(readonly sql: string, private db: FakeDb) {}
  bind(...values: D1Primitive[]): D1PreparedStatement { this.values = values; return this; }
  async first<T>(): Promise<T | null> {
    this.db.touched += 1;
    if (this.sql.includes('app_meta')) return { value: '1' } as T;
    if (this.sql.includes('SELECT id FROM titles')) return { id: String(this.values[0]) } as T;
    return null;
  }
  async all<T>(): Promise<D1Result<T>> {
    this.db.touched += 1;
    if (this.db.failReads) throw new Error('synthetic-sensitive-database-detail');
    return { success: true, results: [] };
  }
  async run<T>(): Promise<D1Result<T>> { this.db.touched += 1; this.db.writes.push({ sql: this.sql, values: this.values }); return { success: true, results: [] }; }
}
class FakeDb implements D1Database {
  touched = 0;
  failReads = false;
  writes: { sql: string; values: D1Primitive[] }[] = [];
  prepare(query: string): D1PreparedStatement { return new Statement(query, this); }
  async batch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> { this.touched += statements.length; return statements.map(() => ({ success: true, results: [] })); }
  async exec(): Promise<{ count: number; duration: number }> { this.touched += 1; return { count: 0, duration: 0 }; }
}
function env(db = new FakeDb(), overrides: Partial<Env> = {}): Env {
  return { DB: db, DEVICE_ACCESS_TOKEN: 'synthetic-test-token', APP_ORIGIN: 'https://app.example', APP_ENV: 'qa', ...overrides };
}
function authHeaders(extra: Record<string, string> = {}) { return { authorization: 'Bearer synthetic-test-token', ...extra }; }

test('health is public but reports whether auth is configured and returns a request id', async () => {
  const response = await handleRequest(new Request('https://worker.example/api/health'), env());
  assert.equal(response.status, 200);
  assert.match(response.headers.get('x-request-id') ?? '', /^[0-9a-f-]{36}$/i);
  const payload = await response.json() as any;
  assert.equal(payload.ok, true);
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.authConfigured, true);
});

test('protected routes fail closed when the Worker secret is missing', async () => {
  const db = new FakeDb();
  const response = await handleRequest(new Request('https://worker.example/api/snapshot'), env(db, { DEVICE_ACCESS_TOKEN: undefined }));
  assert.equal(response.status, 503);
  assert.equal(db.touched, 0);
});

test('protected routes reject invalid credentials before touching D1', async () => {
  const db = new FakeDb();
  const response = await handleRequest(new Request('https://worker.example/api/snapshot', { headers: { authorization: 'Bearer wrong' } }), env(db));
  assert.equal(response.status, 401);
  assert.equal(db.touched, 0);
});

test('rating route validates input before writing', async () => {
  const db = new FakeDb();
  const response = await handleRequest(new Request('https://worker.example/api/ratings/movie-1', {
    method: 'PUT', headers: authHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ stars: 6 })
  }), env(db));
  assert.equal(response.status, 400);
  assert.equal(db.writes.length, 0);
});

test('library add is authenticated and writes only after canonical title existence check', async () => {
  const db = new FakeDb();
  const response = await handleRequest(new Request('https://worker.example/api/library/movie-1', { method: 'PUT', headers: authHeaders() }), env(db));
  assert.equal(response.status, 200);
  assert.equal(db.writes.length, 1);
  assert.match(db.writes[0].sql, /INSERT INTO library_items/);
});

test('CORS is emitted only for the configured exact app origin', async () => {
  const allowed = await handleRequest(new Request('https://worker.example/api/health', { headers: { origin: 'https://app.example' } }), env());
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://app.example');
  const denied = await handleRequest(new Request('https://worker.example/api/health', { headers: { origin: 'https://evil.example' } }), env());
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
});

test('unexpected backend errors do not expose internal database details', async () => {
  const db = new FakeDb();
  db.failReads = true;
  const originalError = console.error;
  console.error = () => {};
  try {
    const response = await handleRequest(new Request('https://worker.example/api/snapshot', { headers: authHeaders() }), env(db));
    assert.equal(response.status, 500);
    const payload = await response.json() as any;
    assert.equal(payload.error, 'request_failed');
    assert.equal(typeof payload.requestId, 'string');
    assert.equal(payload.message, undefined);
    assert.equal(JSON.stringify(payload).includes('synthetic-sensitive-database-detail'), false);
    assert.equal(response.headers.get('x-request-id'), payload.requestId);
  } finally {
    console.error = originalError;
  }
});
