import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleRequest } from '../worker/index.js';
import type { D1Database, D1PreparedStatement, D1Primitive, D1Result, Env } from '../worker/types.js';

class Statement implements D1PreparedStatement {
  values: D1Primitive[] = [];
  constructor(readonly sql: string, private readonly db: RouteDb) {}
  bind(...values: D1Primitive[]): D1PreparedStatement { const next = new Statement(this.sql, this.db); next.values = values; return next; }
  async first<T>(): Promise<T | null> {
    this.db.reads += 1;
    if (this.sql.includes('app_meta') && this.sql.includes('WHERE key = ?')) return null;
    if (this.sql.includes('COUNT(*) AS count')) return { count: 0 } as T;
    return null;
  }
  async all<T>(): Promise<D1Result<T>> { this.db.reads += 1; return { success: true, results: [] }; }
  async run<T>(): Promise<D1Result<T>> { return { success: true, results: [] }; }
}
class RouteDb implements D1Database {
  reads = 0;
  batches = 0;
  prepare(query: string): D1PreparedStatement { return new Statement(query, this); }
  async batch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    this.batches += 1;
    return statements.map(() => ({ success: true, results: [] }));
  }
  async exec(): Promise<{ count: number; duration: number }> { return { count: 0, duration: 0 }; }
}
function env(db: RouteDb): Env {
  return { DB: db, DEVICE_ACCESS_TOKEN: 'synthetic-route-token', APP_ORIGIN: 'https://app.example', APP_ENV: 'qa' };
}
function validBody() {
  return {
    migrationId: '11111111-1111-4111-8111-111111111111',
    snapshot: {
      schemaVersion: 1,
      generatedAt: '2026-09-08T10:00:00.000Z',
      titles: [], metadata: [], seasons: [], episodes: [], watchEvents: [], watchOverrides: [],
      library: [], ratings: [], watchedService: [], services: [], availability: [], alerts: [], syncState: []
    }
  };
}
function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://worker.example/api/migration/local-state', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
}

test('migration endpoint rejects unauthenticated requests before touching D1', async () => {
  const db = new RouteDb();
  const response = await handleRequest(request(validBody(), { origin: 'https://app.example' }), env(db));
  assert.equal(response.status, 401);
  assert.equal(db.reads, 0);
  assert.equal(db.batches, 0);
});

test('migration endpoint enforces configured browser origin before touching D1', async () => {
  const db = new RouteDb();
  const response = await handleRequest(request(validBody(), {
    origin: 'https://evil.example', authorization: 'Bearer synthetic-route-token'
  }), env(db));
  assert.equal(response.status, 403);
  assert.equal(db.reads, 0);
  assert.equal(db.batches, 0);
});

test('authenticated migration route executes the guarded import transaction', async () => {
  const db = new RouteDb();
  const response = await handleRequest(request(validBody(), {
    origin: 'https://app.example', authorization: 'Bearer synthetic-route-token'
  }), env(db));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, alreadyApplied: false });
  assert.ok(db.reads > 0);
  assert.equal(db.batches, 1);
});

test('malformed migration payload returns controlled 400 without a write batch', async () => {
  const db = new RouteDb();
  const response = await handleRequest(request({ migrationId: 'not-a-uuid', snapshot: {} }, {
    origin: 'https://app.example', authorization: 'Bearer synthetic-route-token'
  }), env(db));
  assert.equal(response.status, 400);
  assert.equal((await response.json() as { error: string }).error, 'invalid_migration_payload');
  assert.equal(db.batches, 0);
});
