import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installFakeIndexedDB } from './fake-indexeddb.js';
import type { BackendSnapshot } from '../src/lib/backend-contract.js';
import type { BackendClient } from '../src/lib/backend-client.js';

installFakeIndexedDB();
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

test('backend snapshot hydration replaces fixture cache and keeps multi-option availability', async () => {
  await repo.ensureSeeded();
  assert.notEqual((await repo.allTitles()).length, 0);

  await repo.applyBackendSnapshot(snapshot());

  assert.deepEqual((await repo.allTitles()).map((title) => title.id), ['movie-42']);
  assert.equal((await repo.allLibrary()).length, 1);
  assert.equal((await repo.allRatings())[0]?.stars, 5);
  assert.equal((await repo.allAvailability()).length, 2);
  assert.deepEqual(new Set((await repo.allAvailability()).map((row) => row.optionType)), new Set(['subscription', 'rent']));
  assert.deepEqual(await repo.backendCacheInfo(), { active: true, generatedAt: '2026-09-07T16:30:00.000Z' });
});

test('Worker refresh uses the backend client seam and hydrates the cache only after fetch succeeds', async () => {
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
  await repo.applyBackendSnapshot(snapshot());
  const client: BackendClient = {
    async getSnapshot() { throw new Error('synthetic network unavailable'); },
    async addToLibrary() {}, async removeFromLibrary() {}, async setRating() {}, async clearRating() {}, async markAlertsSeen() {}
  };
  await assert.rejects(() => refreshBackendCache(client), /synthetic network unavailable/);
  assert.deepEqual((await repo.allTitles()).map((title) => title.id), ['movie-42']);
  assert.deepEqual(await repo.backendCacheInfo(), { active: true, generatedAt: snapshot().generatedAt });
});

test('synthetic provider sync cannot mutate a hydrated Worker/D1 cache', async () => {
  await repo.applyBackendSnapshot(snapshot());
  await assert.rejects(() => repo.syncNow(), /Synthetic provider sync is disabled/);
  assert.deepEqual((await repo.allTitles()).map((title) => title.id), ['movie-42']);
  assert.equal((await repo.allAvailability()).length, 2);
});

test('ensureSeeded never overwrites a hydrated backend cache while offline', async () => {
  await repo.applyBackendSnapshot(snapshot());
  await repo.ensureSeeded();
  assert.deepEqual((await repo.allTitles()).map((title) => title.id), ['movie-42']);
});

test('unsupported backend schema is rejected before replacing cached data', async () => {
  await repo.applyBackendSnapshot(snapshot());
  const invalid = { ...snapshot(), schemaVersion: 2 };
  await assert.rejects(() => repo.applyBackendSnapshot(invalid), /Unsupported Streamarkr backend schema version/);
  assert.deepEqual((await repo.allTitles()).map((title) => title.id), ['movie-42']);
});
