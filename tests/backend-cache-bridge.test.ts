import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installFakeIndexedDB } from './fake-indexeddb.js';
import type { BackendSnapshot } from '../src/lib/backend-contract.js';
import type { BackendClient } from '../src/lib/backend-client.js';

installFakeIndexedDB();
const db = await import('../src/lib/db.js');
const repo = await import('../src/lib/repo.js');
const { refreshBackendCache } = await import('../src/lib/backend-cache.js');

function snapshot(): BackendSnapshot {
  return {
    schemaVersion: 1,
    generatedAt: '2026-09-07T16:30:00.000Z',
    titles: [{ id: 'movie-42', mediaType: 'movie', tmdbId: 42, title: 'Synthetic Backend Movie', year: 2026 }],
    metadata: [{ titleId: 'movie-42', status: 'Released', overview: '', genres: ['Drama'], posterPath: '', backdropPath: '', trailerKey: null, metadataUpdatedAt: '2026-09-07T16:00:00.000Z', releaseDate: '2026-09-01' }],
    seasons: [],
    episodes: [],
    watchEvents: [],
    watchOverrides: [],
    library: [{ titleId: 'movie-42', addedAt: '2026-09-07T16:10:00.000Z', derivedStatus: 'To Watch', statusComputedAt: '2026-09-07T16:10:00.000Z' }],
    ratings: [{ titleId: 'movie-42', stars: 5, ratedAt: '2026-09-07T16:11:00.000Z' }],
    watchedService: [],
    services: [{ serviceKey: 'netflix', displayName: 'Netflix', logoGlyph: 'N', userSelected: true, availabilitySource: 'streaming-availability' }],
    availability: [
      { titleId: 'movie-42', serviceKey: 'netflix', optionType: 'subscription', deepLink: null, startsAt: null, endsAt: null, checkedAt: '2026-09-07T16:20:00.000Z', source: 'streaming-availability' },
      { titleId: 'movie-42', serviceKey: 'netflix', optionType: 'rent', deepLink: null, startsAt: null, endsAt: null, checkedAt: '2026-09-07T16:20:00.000Z', source: 'streaming-availability' }
    ],
    alerts: [],
    syncState: []
  };
}

async function hydrateFreshBackendCache(): Promise<void> {
  await db.clearAll();
  await repo.applyBackendSnapshot(snapshot());
}

test('backend snapshot hydration fills an empty cache and keeps multi-option availability', async () => {
  await hydrateFreshBackendCache();

  assert.deepEqual((await repo.allTitles()).map((title) => title.id), ['movie-42']);
  assert.equal((await repo.allLibrary()).length, 1);
  assert.equal((await repo.allRatings())[0]?.stars, 5);
  assert.equal((await repo.allAvailability()).length, 2);
  assert.deepEqual(new Set((await repo.allAvailability()).map((row) => row.optionType)), new Set(['subscription', 'rent']));
  assert.deepEqual(await repo.backendCacheInfo(), { active: true, generatedAt: '2026-09-07T16:30:00.000Z' });
});

test('initial backend takeover refuses to overwrite an existing fixture/local cache', async () => {
  await db.clearAll();
  await repo.ensureSeeded();
  const beforeTitles = (await repo.allTitles()).map((title) => title.id);
  const beforeLibrary = await repo.allLibrary();

  await assert.rejects(
    () => repo.applyBackendSnapshot(snapshot()),
    /Initial Worker\/D1 cache activation is blocked/
  );

  assert.deepEqual((await repo.allTitles()).map((title) => title.id), beforeTitles);
  assert.deepEqual(await repo.allLibrary(), beforeLibrary);
  assert.equal((await repo.backendCacheInfo()).active, false);
});

test('legacy non-empty cache without provenance marker cannot be mistaken for an empty cache', async () => {
  await db.clearAll();
  await repo.ensureSeeded();
  const beforeTitles = (await repo.allTitles()).map((title) => title.id);
  const beforeLibrary = await repo.allLibrary();
  // Simulate a v0.13-or-older installed cache, which had real local rows and seeded_v1 but no
  // data_source marker introduced by this bridge build.
  await db.del('meta', 'data_source');
  assert.equal(await db.get('meta', 'data_source'), undefined);
  assert.equal(await db.hasAnyData(), true);

  await assert.rejects(
    () => repo.applyBackendSnapshot(snapshot()),
    /Initial Worker\/D1 cache activation is blocked/
  );

  assert.deepEqual((await repo.allTitles()).map((title) => title.id), beforeTitles);
  assert.deepEqual(await repo.allLibrary(), beforeLibrary);
  assert.equal((await repo.backendCacheInfo()).active, false);
});

test('Worker refresh uses the backend client seam and hydrates an empty cache only after fetch succeeds', async () => {
  await db.clearAll();
  let calls = 0;
  const client: BackendClient = {
    async getSnapshot() { calls += 1; return snapshot(); },
    async addToLibrary() {}, async removeFromLibrary() {}, async setRating() {}, async clearRating() {}, async markAlertsSeen() {}
  };
  const result = await refreshBackendCache(client);
  assert.equal(calls, 1);
  assert.equal(result.generatedAt, snapshot().generatedAt);
  assert.deepEqual((await repo.allTitles()).map((title) => title.id), ['movie-42']);
});

test('failed Worker refresh leaves the existing offline cache untouched', async () => {
  await hydrateFreshBackendCache();
  const client: BackendClient = {
    async getSnapshot() { throw new Error('synthetic network unavailable'); },
    async addToLibrary() {}, async removeFromLibrary() {}, async setRating() {}, async clearRating() {}, async markAlertsSeen() {}
  };
  await assert.rejects(() => refreshBackendCache(client), /synthetic network unavailable/);
  assert.deepEqual((await repo.allTitles()).map((title) => title.id), ['movie-42']);
  assert.deepEqual(await repo.backendCacheInfo(), { active: true, generatedAt: snapshot().generatedAt });
});

test('synthetic provider sync cannot mutate a hydrated Worker/D1 cache', async () => {
  await hydrateFreshBackendCache();
  await assert.rejects(() => repo.syncNow(), /Synthetic provider sync is disabled/);
  assert.deepEqual((await repo.allTitles()).map((title) => title.id), ['movie-42']);
  assert.equal((await repo.allAvailability()).length, 2);
});

test('local-only user mutations are blocked while Worker/D1 cache mode is active', async () => {
  await hydrateFreshBackendCache();
  await assert.rejects(() => repo.setRating('movie-42', 4), /Local-only mutation is disabled/);
  await assert.rejects(() => repo.removeFromLibrary('movie-42'), /Local-only mutation is disabled/);
  await assert.rejects(() => repo.setWatchedService('movie-42', 'netflix'), /Local-only mutation is disabled/);
  await assert.rejects(() => repo.setMovieOverride('movie-42', 'watched'), /Local-only mutation is disabled/);
  assert.equal((await repo.allRatings())[0]?.stars, 5);
  assert.equal((await repo.allLibrary()).length, 1);
});

test('ensureSeeded never overwrites a hydrated backend cache while offline', async () => {
  await hydrateFreshBackendCache();
  await repo.ensureSeeded();
  assert.deepEqual((await repo.allTitles()).map((title) => title.id), ['movie-42']);
});

test('unsupported backend schema is rejected before replacing cached data', async () => {
  await hydrateFreshBackendCache();
  const invalid = { ...snapshot(), schemaVersion: 2 };
  await assert.rejects(() => repo.applyBackendSnapshot(invalid), /Unsupported Streamarkr backend schema version/);
  assert.deepEqual((await repo.allTitles()).map((title) => title.id), ['movie-42']);
});

test('malformed snapshot rows are rejected before any cache store is cleared', async () => {
  await hydrateFreshBackendCache();
  const invalid = {
    ...snapshot(),
    titles: [{ mediaType: 'movie', tmdbId: 99, title: 'Missing canonical id', year: 2026 }]
  } as unknown as BackendSnapshot;

  await assert.rejects(() => repo.applyBackendSnapshot(invalid), /Invalid titles cache row: missing key field id/);
  assert.deepEqual((await repo.allTitles()).map((title) => title.id), ['movie-42']);
  assert.equal((await repo.allLibrary()).length, 1);
});
