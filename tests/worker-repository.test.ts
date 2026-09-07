import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addLibraryItem, replaceAvailabilitySnapshot, upsertTitle } from '../worker/repository.js';
import type { AvailabilityEntry, Title } from '../src/lib/types.js';
import type { D1Database, D1PreparedStatement, D1Primitive, D1Result } from '../worker/types.js';

class Statement implements D1PreparedStatement {
  values: D1Primitive[] = [];
  constructor(readonly sql: string, private db: RecordingDb) {}
  bind(...values: D1Primitive[]): D1PreparedStatement { const next = new Statement(this.sql, this.db); next.values = values; return next; }
  async first<T>(): Promise<T | null> {
    this.db.reads.push({ sql: this.sql, values: this.values });
    if (this.sql.includes('SELECT id FROM titles') && this.db.knownTitles.has(String(this.values[0]))) return { id: String(this.values[0]) } as T;
    return null;
  }
  async all<T>(): Promise<D1Result<T>> { return { success: true, results: [] }; }
  async run<T>(): Promise<D1Result<T>> { this.db.writes.push({ sql: this.sql, values: this.values }); return { success: true, results: [] }; }
}
class RecordingDb implements D1Database {
  knownTitles = new Set<string>();
  reads: { sql: string; values: D1Primitive[] }[] = [];
  writes: { sql: string; values: D1Primitive[] }[] = [];
  batches: { sql: string; values: D1Primitive[] }[][] = [];
  prepare(query: string): D1PreparedStatement { return new Statement(query, this); }
  async batch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const batch = statements.map((statement) => { const item = statement as Statement; return { sql: item.sql, values: item.values }; });
    this.batches.push(batch);
    return batch.map(() => ({ success: true, results: [] }));
  }
  async exec(): Promise<{ count: number; duration: number }> { return { count: 0, duration: 0 }; }
}
const title: Title = { id: 'movie-1', mediaType: 'movie', tmdbId: 1, title: 'One', year: 2026 };

test('provider title upsert writes only the provider-owned titles table', async () => {
  const db = new RecordingDb();
  await upsertTitle(db, title);
  assert.equal(db.writes.length, 1);
  assert.match(db.writes[0].sql, /INSERT INTO titles/);
  assert.equal(/library_items|ratings|watch_overrides|watched_service/.test(db.writes[0].sql), false);
});

test('Library membership refuses dangling title ids', async () => {
  const db = new RecordingDb();
  await assert.rejects(() => addLibraryItem(db, 'missing', '2026-09-07T00:00:00Z'), /canonical title record/);
  assert.equal(db.writes.length, 0);
});

test('Library membership is allowed after canonical identity exists', async () => {
  const db = new RecordingDb();
  db.knownTitles.add('movie-1');
  await addLibraryItem(db, 'movie-1', '2026-09-07T00:00:00Z');
  assert.equal(db.writes.length, 1);
  assert.match(db.writes[0].sql, /library_items/);
});

test('availability replacement is one transactional batch and supports multiple option types', async () => {
  const db = new RecordingDb();
  const entries: AvailabilityEntry[] = [
    { titleId: 'movie-1', serviceKey: 'netflix', optionType: 'subscription', deepLink: null, startsAt: null, endsAt: null, checkedAt: '2026-09-07T00:00:00Z', source: 'streaming-availability' },
    { titleId: 'movie-1', serviceKey: 'netflix', optionType: 'rent', deepLink: null, startsAt: null, endsAt: null, checkedAt: '2026-09-07T00:00:00Z', source: 'streaming-availability' }
  ];
  await replaceAvailabilitySnapshot(db, entries);
  assert.equal(db.batches.length, 1);
  assert.equal(db.batches[0].length, 3);
  assert.match(db.batches[0][0].sql, /^DELETE FROM availability/);
  assert.equal(db.batches[0][1].values[2], 'subscription');
  assert.equal(db.batches[0][2].values[2], 'rent');
  assert.equal(db.batches[0].some((entry) => /library_items|ratings|watch_overrides|watched_service/.test(entry.sql)), false);
});
