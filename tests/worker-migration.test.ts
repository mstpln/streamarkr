import assert from 'node:assert/strict';
import { test } from 'node:test';
import { importLocalState, InvalidMigrationPayloadError, MigrationConflictError } from '../worker/migration.js';
import type { BackendMigrationBundle, BackendSnapshot } from '../src/lib/backend-contract.js';
import type { D1Database, D1PreparedStatement, D1Primitive, D1Result } from '../worker/types.js';

type DbRow = Record<string, D1Primitive>;

class Statement implements D1PreparedStatement {
  values: D1Primitive[] = [];
  constructor(readonly sql: string, private db: RecordingDb) {}
  bind(...values: D1Primitive[]): D1PreparedStatement { const next = new Statement(this.sql, this.db); next.values = values; return next; }
  async first<T>(): Promise<T | null> {
    this.db.reads.push({ sql: this.sql, values: this.values });
    if (this.sql.includes("key = 'schema_version'")) return { value: '1' } as T;
    if (this.sql.includes('app_meta') && this.sql.includes('WHERE key = ?')) {
      const key = String(this.values[0] ?? '');
      const value = key === 'local_state_migration_id' ? this.db.migrationId
        : key === 'local_state_migration_hash' ? this.db.migrationHash
        : null;
      return value ? { value } as T : null;
    }
    if (this.sql.includes('COUNT(*) AS count')) {
      const table = this.sql.match(/FROM\s+([a-z_]+)/i)?.[1] ?? '';
      return { count: this.db.nonEmptyTables.has(table) ? 1 : 0 } as T;
    }
    return null;
  }
  async all<T>(): Promise<D1Result<T>> {
    const snapshot = this.db.currentSnapshot;
    if (!snapshot) return { success: true, results: [] };
    let results: DbRow[] = [];
    if (/FROM\s+library_items/i.test(this.sql)) {
      results = snapshot.library.map((row) => ({
        title_id: row.titleId, added_at: row.addedAt, derived_status: row.derivedStatus, status_computed_at: row.statusComputedAt
      }));
    } else if (/FROM\s+ratings/i.test(this.sql)) {
      results = snapshot.ratings.map((row) => ({ title_id: row.titleId, stars: row.stars, rated_at: row.ratedAt }));
    } else if (/FROM\s+watched_service/i.test(this.sql)) {
      results = snapshot.watchedService.map((row) => ({ title_id: row.titleId, service_key: row.serviceKey, changed_at: row.changedAt }));
    } else if (/FROM\s+watch_events/i.test(this.sql)) {
      results = snapshot.watchEvents.map((row) => ({
        provider_event_id: row.providerEventId, id: row.id, title_id: row.titleId,
        season_number: row.seasonNumber ?? null, episode_number: row.episodeNumber ?? null,
        watched_at: row.watchedAt, source: 'trakt'
      }));
    } else if (/FROM\s+watch_overrides/i.test(this.sql)) {
      results = snapshot.watchOverrides.map((row) => ({
        id: row.id, scope_type: row.scopeType, title_id: row.titleId,
        season_number: row.seasonNumber ?? null, episode_number: row.episodeNumber ?? null,
        state: row.state, changed_at: row.changedAt
      }));
    } else if (/FROM\s+services/i.test(this.sql)) {
      results = snapshot.services.map((row) => ({
        service_key: row.serviceKey, display_name: row.displayName, logo_ref: row.logoGlyph,
        user_selected: row.userSelected ? 1 : 0, availability_source: row.availabilitySource
      }));
    } else if (/FROM\s+alerts/i.test(this.sql)) {
      results = snapshot.alerts.map((row) => ({
        id: row.id, title_id: row.titleId, alert_type: row.alertType, message: row.message,
        event_date: row.eventDate, created_at: row.createdAt, seen_at: row.seenAt, dedupe_key: row.dedupeKey
      }));
    }
    return { success: true, results: results as T[] };
  }
  async run<T>(): Promise<D1Result<T>> { return { success: true, results: [] }; }
}

class RecordingDb implements D1Database {
  migrationId: string | null = null;
  migrationHash: string | null = null;
  currentSnapshot: BackendSnapshot | null = null;
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
    for (const row of rows) {
      if (row.sql.includes('INSERT INTO app_meta')) {
        const key = String(row.values[0] ?? '');
        const value = String(row.values[1] ?? '');
        if (key === 'local_state_migration_id') this.migrationId = value;
        if (key === 'local_state_migration_hash') this.migrationHash = value;
      }
    }
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
  assert.ok(batch.some((entry) => entry.values[0] === 'local_state_migration_hash'));
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

test('same migration id and unchanged durable state is retry-idempotent without another write batch', async () => {
  const db = new RecordingDb();
  const payload = bundle();
  await importLocalState(db, payload);
  db.currentSnapshot = structuredClone(payload.snapshot);
  const result = await importLocalState(db, payload);
  assert.deepEqual(result, { alreadyApplied: true });
  assert.equal(db.batches.length, 1);
});

test('same migration id safely reconciles local changes made after an uncertain first response', async () => {
  const db = new RecordingDb();
  const first = bundle();
  await importLocalState(db, first);
  db.currentSnapshot = structuredClone(first.snapshot);

  const changed = bundle();
  changed.snapshot.ratings = [{ ...changed.snapshot.ratings[0], stars: 5, ratedAt: '2026-09-08T09:20:00.000Z' }];
  const result = await importLocalState(db, changed);

  assert.deepEqual(result, { alreadyApplied: false });
  assert.equal(db.batches.length, 2);
  assert.ok(db.batches[1].some((entry) => /DELETE FROM ratings/.test(entry.sql)));
  assert.ok(db.batches[1].some((entry) => /INSERT INTO ratings/.test(entry.sql) && entry.values[1] === 5));
});

test('changed same-id retry fails closed if backend durable user state changed independently', async () => {
  const db = new RecordingDb();
  const first = bundle();
  await importLocalState(db, first);
  db.currentSnapshot = structuredClone(first.snapshot);
  db.currentSnapshot.ratings = [{ ...db.currentSnapshot.ratings[0], stars: 2, ratedAt: '2026-09-08T09:15:00.000Z' }];

  const changed = bundle();
  changed.snapshot.ratings = [{ ...changed.snapshot.ratings[0], stars: 5 }];
  await assert.rejects(() => importLocalState(db, changed), /durable user state changed/);
  assert.equal(db.batches.length, 1);
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
