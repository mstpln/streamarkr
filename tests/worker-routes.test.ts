import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleRequest } from '../worker/index.js';
import type { Title } from '../src/lib/types.js';
import type { D1Database, D1PreparedStatement, D1Primitive, D1Result, Env } from '../worker/types.js';

class Statement implements D1PreparedStatement {
  values: D1Primitive[] = [];
  constructor(readonly sql: string, private db: FakeDb) {}
  bind(...values: D1Primitive[]): D1PreparedStatement { this.values = values; return this; }
  async first<T>(): Promise<T | null> {
    this.db.touched += 1;
    if (this.sql.includes('app_meta')) return { value: '1' } as T;
    const titleId = String(this.values[0]);
    if (this.sql.includes('SELECT id FROM titles') && this.db.knownTitleTypes.has(titleId)) return { id: titleId } as T;
    if (this.sql.includes('SELECT media_type FROM titles')) {
      const mediaType = this.db.knownTitleTypes.get(titleId);
      return mediaType ? { media_type: mediaType } as T : null;
    }
    if (this.sql.includes('SELECT service_key FROM services') && this.db.knownServices.has(String(this.values[0]))) return { service_key: String(this.values[0]) } as T;
    if (this.sql.includes('SELECT season_number FROM seasons') && this.db.knownSeasons.has(`${this.values[0]}:${this.values[1]}`)) {
      return { season_number: Number(this.values[1]) } as T;
    }
    if (this.sql.includes('SELECT episode_number FROM episodes') && this.db.knownEpisodes.has(`${this.values[0]}:${this.values[1]}:${this.values[2]}`)) {
      return { episode_number: Number(this.values[2]) } as T;
    }
    return null;
  }
  async all<T>(): Promise<D1Result<T>> {
    this.db.touched += 1;
    if (this.db.failReads) throw new Error('synthetic-sensitive-database-detail');
    if (this.sql.includes('SELECT episode_number FROM episodes')) {
      return { success: true, results: this.db.releasedEpisodeNumbers.map((episode_number) => ({ episode_number } as T)) };
    }
    return { success: true, results: [] };
  }
  async run<T>(): Promise<D1Result<T>> { this.db.touched += 1; this.db.writes.push({ sql: this.sql, values: this.values }); return { success: true, results: [] }; }
}
class FakeDb implements D1Database {
  touched = 0;
  failReads = false;
  knownTitleTypes = new Map<string, Title['mediaType']>([['movie-1', 'movie'], ['series-1', 'series']]);
  knownServices = new Set(['netflix', 'hbo-max']);
  knownSeasons = new Set(['series-1:0', 'series-1:2']);
  knownEpisodes = new Set(['series-1:2:3', 'series-1:0:1']);
  releasedEpisodeNumbers = [1, 2, 3];
  writes: { sql: string; values: D1Primitive[] }[] = [];
  batches: { sql: string; values: D1Primitive[] }[][] = [];
  prepare(query: string): D1PreparedStatement { return new Statement(query, this); }
  async batch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    this.touched += statements.length;
    const batch = statements.map((statement) => {
      const item = statement as Statement;
      return { sql: item.sql, values: item.values };
    });
    this.batches.push(batch);
    return statements.map(() => ({ success: true, results: [] }));
  }
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

test('rating an unknown canonical title returns a controlled conflict instead of a backend failure', async () => {
  const db = new FakeDb();
  const response = await handleRequest(new Request('https://worker.example/api/ratings/movie-999', {
    method: 'PUT', headers: authHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ stars: 5 })
  }), env(db));
  assert.equal(response.status, 409);
  const payload = await response.json() as any;
  assert.equal(payload.error, 'missing_canonical_title');
  assert.match(payload.message, /movie-999/);
  assert.equal(db.writes.length, 0);
});

test('library add is authenticated and writes only after canonical title existence check', async () => {
  const db = new FakeDb();
  const response = await handleRequest(new Request('https://worker.example/api/library/movie-1', { method: 'PUT', headers: authHeaders() }), env(db));
  assert.equal(response.status, 200);
  assert.equal(db.writes.length, 1);
  assert.match(db.writes[0].sql, /INSERT INTO library_items/);
});

test('watched-service route validates the service and persists or clears the durable selection', async () => {
  const db = new FakeDb();
  const put = await handleRequest(new Request('https://worker.example/api/watched-service/movie-1', {
    method: 'PUT', headers: authHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ serviceKey: 'netflix' })
  }), env(db));
  assert.equal(put.status, 200);
  assert.match(db.writes.at(-1)?.sql ?? '', /INSERT INTO watched_service/);
  assert.deepEqual(db.writes.at(-1)?.values.slice(0, 2), ['movie-1', 'netflix']);

  const del = await handleRequest(new Request('https://worker.example/api/watched-service/movie-1', { method: 'DELETE', headers: authHeaders() }), env(db));
  assert.equal(del.status, 204);
  assert.match(db.writes.at(-1)?.sql ?? '', /DELETE FROM watched_service/);
});

test('unknown watched-service keys return a controlled conflict', async () => {
  const db = new FakeDb();
  const response = await handleRequest(new Request('https://worker.example/api/watched-service/movie-1', {
    method: 'PUT', headers: authHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ serviceKey: 'not-real' })
  }), env(db));
  assert.equal(response.status, 409);
  assert.equal((await response.json() as any).error, 'missing_service');
});

test('movie and episode override routes validate scope and persist durable corrections', async () => {
  const db = new FakeDb();
  const movie = await handleRequest(new Request('https://worker.example/api/overrides/movie/movie-1', {
    method: 'PUT', headers: authHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ state: 'watched' })
  }), env(db));
  assert.equal(movie.status, 200);
  assert.equal(db.writes.at(-1)?.values[1], 'movie');

  const episode = await handleRequest(new Request('https://worker.example/api/overrides/episode/series-1', {
    method: 'PUT', headers: authHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({ seasonNumber: 2, episodeNumber: 3, state: 'unwatched' })
  }), env(db));
  assert.equal(episode.status, 200);
  assert.deepEqual(db.writes.at(-1)?.values.slice(1, 6), ['episode', 'series-1', 2, 3, 'unwatched']);
});

test('override routes reject media-type scope mismatches before touching D1', async () => {
  const movieAsSeries = new FakeDb();
  const movieResponse = await handleRequest(new Request('https://worker.example/api/overrides/movie/series-1', {
    method: 'PUT', headers: authHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ state: 'watched' })
  }), env(movieAsSeries));
  assert.equal(movieResponse.status, 400);
  assert.equal((await movieResponse.json() as any).error, 'invalid_override_scope');
  assert.equal(movieAsSeries.touched, 0);

  const episodeAsMovie = new FakeDb();
  const episodeResponse = await handleRequest(new Request('https://worker.example/api/overrides/episode/movie-1', {
    method: 'PUT', headers: authHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({ seasonNumber: 1, episodeNumber: 1, state: 'watched' })
  }), env(episodeAsMovie));
  assert.equal(episodeResponse.status, 400);
  assert.equal((await episodeResponse.json() as any).error, 'invalid_override_scope');
  assert.equal(episodeAsMovie.touched, 0);
});

test('episode override supports season zero specials', async () => {
  const db = new FakeDb();
  const response = await handleRequest(new Request('https://worker.example/api/overrides/episode/series-1', {
    method: 'PUT', headers: authHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({ seasonNumber: 0, episodeNumber: 1, state: 'watched' })
  }), env(db));
  assert.equal(response.status, 200);
  assert.deepEqual(db.writes.at(-1)?.values.slice(1, 6), ['episode', 'series-1', 0, 1, 'watched']);
});

test('episode override rejects an episode that does not exist', async () => {
  const db = new FakeDb();
  const response = await handleRequest(new Request('https://worker.example/api/overrides/episode/series-1', {
    method: 'PUT', headers: authHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({ seasonNumber: 2, episodeNumber: 99, state: 'watched' })
  }), env(db));
  assert.equal(response.status, 409);
  assert.equal((await response.json() as any).error, 'missing_episode');
});

test('season override rejects a season that does not exist', async () => {
  const db = new FakeDb();
  const response = await handleRequest(new Request('https://worker.example/api/overrides/season/series-1', {
    method: 'PUT', headers: authHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({ seasonNumber: 7, state: 'watched' })
  }), env(db));
  assert.equal(response.status, 409);
  assert.equal((await response.json() as any).error, 'missing_season');
  assert.equal(db.batches.length, 0);
});

test('season override materializes only server-known released episodes and reports the affected count', async () => {
  const db = new FakeDb();
  const response = await handleRequest(new Request('https://worker.example/api/overrides/season/series-1', {
    method: 'PUT', headers: authHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({ seasonNumber: 2, state: 'watched' })
  }), env(db));
  assert.equal(response.status, 200);
  assert.equal((await response.json() as any).affectedEpisodes, 3);
  assert.equal(db.batches.length, 1);
  assert.match(db.batches[0][0].sql, /DELETE FROM watch_overrides/);
  assert.equal(db.batches[0].filter((entry) => /INSERT INTO watch_overrides/.test(entry.sql)).length, 3);
});

test('season bulk override accepts season zero specials', async () => {
  const db = new FakeDb();
  db.releasedEpisodeNumbers = [1];
  const response = await handleRequest(new Request('https://worker.example/api/overrides/season/series-1', {
    method: 'PUT', headers: authHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({ seasonNumber: 0, state: 'watched' })
  }), env(db));
  assert.equal(response.status, 200);
  assert.equal((await response.json() as any).affectedEpisodes, 1);
  assert.deepEqual(db.batches[0][1].values.slice(1, 6), ['episode', 'series-1', 0, 1, 'watched']);
});

test('service preference and custom-service routes persist through D1', async () => {
  const db = new FakeDb();
  const selected = await handleRequest(new Request('https://worker.example/api/services/hbo-max/selected', {
    method: 'PUT', headers: authHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ selected: true })
  }), env(db));
  assert.equal(selected.status, 200);
  assert.match(db.writes.at(-1)?.sql ?? '', /UPDATE services SET user_selected/);

  const custom = await handleRequest(new Request('https://worker.example/api/services/custom', {
    method: 'POST', headers: authHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ displayName: 'MUBI + More' })
  }), env(db));
  assert.equal(custom.status, 200);
  assert.equal((await custom.json() as any).serviceKey, 'mubi-more');
  assert.match(db.writes.at(-1)?.sql ?? '', /INSERT INTO services/);
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
