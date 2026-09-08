import assert from 'node:assert/strict';
import { test } from 'node:test';
import { importLocalState, InvalidMigrationPayloadError, MigrationConflictError } from '../worker/migration.js';
import type { BackendMigrationBundle, BackendSnapshot } from '../src/lib/backend-contract.js';
import type { D1Database, D1PreparedStatement, D1Primitive, D1Result } from '../worker/types.js';

class Statement implements D1PreparedStatement {
  values: D1Primitive[] = [];
  constructor(readonly sql: string, private db: RecordingDb) {}
  bind(...values: D1Primitive[]): D1PreparedStatement { const next = new Statement(this.sql, this.db); next.values = values; return next; }
  async first<T>(): Promise<T | null> {
    this.db.reads.push({ sql: this.sql, values: this.values });
    if (this.sql.includes('app_meta') && this.sql.includes('WHERE key = ?')) {
      return this.db.migrationId ? { value: this.db.migrationId } as T : null;
    }
    if (this.sql.includes('COUNT(*) AS count')) {
      const table = this.sql.match(/FROM\s+([a-z_]+)/i)?.[1] ?? '';
      return { count: this.db.nonEmptyTables.has(table) ? 1 : 0 } as T;
    }
    return null;
  }
  async all<T>(): Promise<D1Result<T>> { return { success: true, results: [] }; }
  async run<T>(): Promise<D1Result<T>> { return { success: true, results: [] }; }
}

class RecordingDb implements D1Database {
  migrationId: string | null = null;
  nonEmptyTables = new Set<string>();
  reads: { sql: string; values: D1Primitive[] }[] = [];
  batches: { sql: string; values: D1Primitive[] }[][] = [];
  prepare(query: string): D1PreparedStatement { return new Statement(query, this); }
  async batch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const rows = statements.map((statement) => {
      const s = statement as Statement;
      return { sql: s.sql, values: s.values };
    });
    this.batches.push(rows);
    return rows.map(() => ({ success: true, results: [] }));
  }
  async exec(): Promise<{ count: number; duration: number }> { return { count: 0, duration: 0 }; }
}

function snapshot(): BackendSnapshot {
  return {
    schemaVersion: 1,
    generatedAt: '2026-09-08T10:00:00.000Z',
    titles: [{ id: 'movie-42', mediaType: 'movie', tmdbId: 42, title: 'Synthetic Migration Movie', year: 2026 }],
    metadata: [], seasons: [], episodes: [], watchEvents: [], watchOverrides: [],
    library: [{ titleId: 'movie-42', addedAt: '2026-09-08T09:00:00.000Z', derivedStatus: 'To Watch', statusComputedAt: '2026-09-08T09:00:00.000Z' }],
    ratings: [{ titleId: 'movie-42', stars: 4, ratedAt: '2026-09-08T09:10:00.000Z' }],
    watchedService: [],
    services: [{ serviceKey: 'netflix', displayName: 'Netflix', logoGlyph: 'N', userSelected: true, availabilitySource: 'streaming-availability' }],
    availability: [], alerts: [], syncState: []
  };
}
function bundle(id = '11111111-1111-4111-8111-111111111111'): BackendMigrationBundle {
  return { migrationId: id, snapshot: snapshot() };
}

test('pristine backend migration writes user/cache state and marker in one batch', async () => {
  const db = new RecordingDb();
  const result = await importLocalState(db, bundle());
  assert.deepEqual(result, { alreadyApplied: false });
  assert.equal(db.batches.length, 1);
  const batch = db.batches[0];
  assert.ok(batch.some((entry) => /INSERT INTO titles/.test(entry.sql)));
  assert.ok(batch.some((entry) => /INSERT INTO library_items/.test(entry.sql)));
  assert.ok(batch.some((entry) => /INSERT INTO ratings/.test(entry.sql)));
  assert.match(batch.at(-1)?.sql ?? '', /INSERT INTO app_meta/);
  assert.deepEqual(batch.at(-1)?.values, ['local_state_migration_id', bundle().migrationId]);
});

test('provider-owned sync timestamps are not promoted from browser cache into durable D1', async () => {
  const db = new RecordingDb();
  const payload = bundle();
  payload.snapshot.syncState = [{
    syncType: 'trakt',
    lastAttemptAt: '2026-09-08T09:00:00.000Z',
    lastSuccessAt: '2026-09-08T09:00:00.000Z'
  }];
  await importLocalState(db, payload);
  assert.equal(db.batches[0].some((entry) => /INSERT INTO sync_state/.test(entry.sql)), false);
});

test('same migration id is retry-idempotent without another write batch', async () => {
  const db = new RecordingDb();
  db.migrationId = bundle().migrationId;
  const result = await importLocalState(db, bundle());
  assert.deepEqual(result, { alreadyApplied: true });
  assert.equal(db.batches.length, 0);
});

test('different prior migration id fails closed', async () => {
  const db = new RecordingDb();
  db.migrationId = '22222222-2222-4222-8222-222222222222';
  await assert.rejects(() => importLocalState(db, bundle()), MigrationConflictError);
  assert.equal(db.batches.length, 0);
});

test('non-pristine durable state refuses first takeover instead of guessing merge semantics', async () => {
  const db = new RecordingDb();
  db.nonEmptyTables.add('ratings');
  await assert.rejects(() => importLocalState(db, bundle()), /ratings already contains rows/);
  assert.equal(db.batches.length, 0);
});

test('invalid canonical identity is rejected before D1 writes', async () => {
  const db = new RecordingDb();
  const invalid = bundle();
  invalid.snapshot.titles[0] = { ...invalid.snapshot.titles[0], id: 'movie-999' };
  await assert.rejects(() => importLocalState(db, invalid), InvalidMigrationPayloadError);
  assert.equal(db.batches.length, 0);
  assert.equal(db.reads.length, 0);
});

test('malformed cache-owned metadata is rejected as a controlled payload error before D1 access', async () => {
  const db = new RecordingDb();
  const invalid = bundle();
  invalid.snapshot.metadata = [{
    titleId: 'movie-42',
    status: 'Released',
    overview: 'synthetic',
    genres: ['Drama'],
    posterPath: '',
    backdropPath: '',
    trailerKey: null,
    metadataUpdatedAt: 'not-a-date'
  }];
  await assert.rejects(() => importLocalState(db, invalid), InvalidMigrationPayloadError);
  assert.equal(db.batches.length, 0);
  assert.equal(db.reads.length, 0);
});
