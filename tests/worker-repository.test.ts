import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addCustomService,
  addLibraryItem,
  replaceAvailabilitySnapshot,
  setEpisodeOverride,
  setMovieOverride,
  setSeasonOverride,
  setServiceSelected,
  setWatchedService,
  upsertTitle
} from '../worker/repository.js';
import type { AvailabilityEntry, Title } from '../src/lib/types.js';
import type { D1Database, D1PreparedStatement, D1Primitive, D1Result } from '../worker/types.js';

class Statement implements D1PreparedStatement {
  values: D1Primitive[] = [];
  constructor(readonly sql: string, private db: RecordingDb) {}
  bind(...values: D1Primitive[]): D1PreparedStatement { const next = new Statement(this.sql, this.db); next.values = values; return next; }
  async first<T>(): Promise<T | null> {
    this.db.reads.push({ sql: this.sql, values: this.values });
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
    this.db.reads.push({ sql: this.sql, values: this.values });
    if (this.sql.includes('SELECT episode_number FROM episodes')) {
      return { success: true, results: this.db.releasedEpisodeNumbers.map((episode_number) => ({ episode_number } as T)) };
    }
    return { success: true, results: [] };
  }
  async run<T>(): Promise<D1Result<T>> { this.db.writes.push({ sql: this.sql, values: this.values }); return { success: true, results: [] }; }
}
class RecordingDb implements D1Database {
  knownTitleTypes = new Map<string, Title['mediaType']>();
  knownServices = new Set<string>();
  knownSeasons = new Set<string>();
  knownEpisodes = new Set<string>();
  releasedEpisodeNumbers: number[] = [];
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

test('provider title upsert preserves known crosswalk ids when a later payload omits them', async () => {
  const db = new RecordingDb();
  await upsertTitle(db, title);
  assert.equal(db.writes.length, 1);
  assert.match(db.writes[0].sql, /trakt_id=COALESCE\(excluded\.trakt_id, titles\.trakt_id\)/);
  assert.match(db.writes[0].sql, /imdb_id=COALESCE\(excluded\.imdb_id, titles\.imdb_id\)/);
  assert.match(db.writes[0].sql, /availability_id=COALESCE\(excluded\.availability_id, titles\.availability_id\)/);
  assert.equal(db.writes[0].values[3], null);
  assert.equal(db.writes[0].values[4], null);
  assert.equal(db.writes[0].values[5], null);
});

test('Library membership refuses dangling title ids', async () => {
  const db = new RecordingDb();
  await assert.rejects(() => addLibraryItem(db, 'missing', '2026-09-07T00:00:00Z'), /canonical title record/);
  assert.equal(db.writes.length, 0);
});

test('Library membership is allowed after canonical identity exists', async () => {
  const db = new RecordingDb();
  db.knownTitleTypes.set('movie-1', 'movie');
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

test('watched-service mutation requires both canonical title and known service', async () => {
  const db = new RecordingDb();
  db.knownTitleTypes.set('movie-1', 'movie');
  await assert.rejects(() => setWatchedService(db, 'movie-1', 'missing', '2026-09-07T00:00:00Z'), /streaming service record/);
  assert.equal(db.writes.length, 0);

  db.knownServices.add('netflix');
  await setWatchedService(db, 'movie-1', 'netflix', '2026-09-07T00:00:00Z');
  assert.match(db.writes[0].sql, /INSERT INTO watched_service/);
  assert.deepEqual(db.writes[0].values.slice(0, 2), ['movie-1', 'netflix']);
});

test('override repository enforces movie/series media scope before writing', async () => {
  const db = new RecordingDb();
  db.knownTitleTypes.set('movie-1', 'movie');
  db.knownTitleTypes.set('series-1', 'series');

  await assert.rejects(
    () => setMovieOverride(db, 'series-1', 'watched', '2026-09-07T00:00:00Z', 'ov-movie'),
    /must be a movie/
  );
  await assert.rejects(
    () => setEpisodeOverride(db, 'movie-1', 1, 1, 'watched', '2026-09-07T00:00:00Z', 'ov-episode'),
    /must be a series/
  );
  assert.equal(db.writes.length, 0);
});

test('episode correction refuses unknown episodes before writing', async () => {
  const db = new RecordingDb();
  db.knownTitleTypes.set('series-1', 'series');
  await assert.rejects(() => setEpisodeOverride(db, 'series-1', 2, 3, 'watched', '2026-09-07T00:00:00Z', 'ov-test'), /Missing episode record/);
  assert.equal(db.writes.length, 0);

  db.knownEpisodes.add('series-1:2:3');
  await setEpisodeOverride(db, 'series-1', 2, 3, 'watched', '2026-09-07T00:00:00Z', 'ov-test');
  assert.match(db.writes[0].sql, /INSERT INTO watch_overrides/);
  assert.deepEqual(db.writes[0].values, ['ov-test', 'episode', 'series-1', 2, 3, 'watched', '2026-09-07T00:00:00Z']);
});

test('season correction refuses a missing season before batching writes', async () => {
  const db = new RecordingDb();
  db.knownTitleTypes.set('series-1', 'series');
  await assert.rejects(() => setSeasonOverride(db, 'series-1', 7, 'watched', '2026-09-07T12:00:00Z'), /Missing season record/);
  assert.equal(db.batches.length, 0);
});

test('season correction materializes only released episodes in one transactional batch', async () => {
  const db = new RecordingDb();
  db.knownTitleTypes.set('series-1', 'series');
  db.knownSeasons.add('series-1:3');
  db.releasedEpisodeNumbers = [1, 2, 4];
  const affected = await setSeasonOverride(db, 'series-1', 3, 'unwatched', '2026-09-07T12:00:00Z');
  assert.equal(affected, 3);
  assert.equal(db.batches.length, 1);
  assert.match(db.batches[0][0].sql, /scope_type = 'season'/);
  assert.deepEqual(db.batches[0].slice(1).map((entry) => entry.values.slice(1, 6)), [
    ['episode', 'series-1', 3, 1, 'unwatched'],
    ['episode', 'series-1', 3, 2, 'unwatched'],
    ['episode', 'series-1', 3, 4, 'unwatched']
  ]);
  const releasedQuery = db.reads.find((entry) => entry.sql.includes('air_date <= ?'));
  assert.deepEqual(releasedQuery?.values, ['series-1', 3, '2026-09-07']);
});

test('season zero remains a valid bounded bulk correction scope', async () => {
  const db = new RecordingDb();
  db.knownTitleTypes.set('series-1', 'series');
  db.knownSeasons.add('series-1:0');
  db.releasedEpisodeNumbers = [1];
  const affected = await setSeasonOverride(db, 'series-1', 0, 'watched', '2026-09-07T12:00:00Z');
  assert.equal(affected, 1);
  assert.deepEqual(db.batches[0][1].values.slice(1, 6), ['episode', 'series-1', 0, 1, 'watched']);
});

test('service preferences validate existence and custom services normalize durable unsupported keys', async () => {
  const db = new RecordingDb();
  await assert.rejects(() => setServiceSelected(db, 'missing', true), /streaming service record/);
  db.knownServices.add('netflix');
  await setServiceSelected(db, 'netflix', true);
  assert.match(db.writes[0].sql, /UPDATE services SET user_selected/);
  assert.deepEqual(db.writes[0].values, [1, 'netflix']);

  const key = await addCustomService(db, 'MUBI + More');
  assert.equal(key, 'mubi-more');
  assert.match(db.writes[1].sql, /availability_source/);
  assert.deepEqual(db.writes[1].values.slice(0, 2), ['mubi-more', 'MUBI + More']);
});
