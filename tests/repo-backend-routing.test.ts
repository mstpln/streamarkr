import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installFakeIndexedDB } from './fake-indexeddb.js';
import type { BackendSnapshot } from '../src/lib/backend-contract.js';
import type { BackendClient } from '../src/lib/backend-client.js';

installFakeIndexedDB();
const db = await import('../src/lib/db.js');
const repo = await import('../src/lib/repo.js');

function snapshot(stars: 1 | 2 | 3 | 4 | 5 = 5): BackendSnapshot {
  return {
    schemaVersion: 1,
    generatedAt: '2026-09-08T11:00:00.000Z',
    titles: [{ id: 'movie-42', mediaType: 'movie', tmdbId: 42, title: 'Synthetic Backend Movie', year: 2026 }],
    metadata: [], seasons: [], episodes: [], watchEvents: [], watchOverrides: [],
    library: [{ titleId: 'movie-42', addedAt: '2026-09-08T10:00:00.000Z', derivedStatus: 'To Watch', statusComputedAt: '2026-09-08T10:00:00.000Z' }],
    ratings: [{ titleId: 'movie-42', stars, ratedAt: '2026-09-08T10:10:00.000Z' }],
    watchedService: [], services: [], availability: [], alerts: [], syncState: []
  };
}

class Client implements BackendClient {
  current = snapshot();
  ratingCalls: Array<{ titleId: string; stars: number }> = [];
  failSnapshot = false;
  async getSnapshot() { if (this.failSnapshot) throw new Error('synthetic backend unavailable'); return structuredClone(this.current); }
  async addToLibrary() {}
  async removeFromLibrary() {}
  async setRating(titleId: string, stars: 1 | 2 | 3 | 4 | 5) { this.ratingCalls.push({ titleId, stars }); this.current = snapshot(stars); }
  async clearRating() {}
  async setWatchedService() {}
  async setMovieOverride() {}
  async setEpisodeOverride() {}
  async setSeasonOverride() { return { affectedEpisodes: 0 }; }
  async setServiceSelected() {}
  async addCustomService() { return { serviceKey: 'synthetic' }; }
  async markAlertsSeen() {}
}

async function activate(client: Client): Promise<void> {
  await db.clearAll();
  await repo.applyBackendSnapshot(client.current);
  repo.configureBackendClient(client);
}

test('active cache routes rating mutation through Worker and refreshes authoritative snapshot', async () => {
  const client = new Client();
  await activate(client);
  await repo.setRating('movie-42', 3);
  assert.deepEqual(client.ratingCalls, [{ titleId: 'movie-42', stars: 3 }]);
  assert.equal((await repo.allRatings())[0]?.stars, 3);
});

test('failed post-mutation refresh never clears the last verified offline cache', async () => {
  const client = new Client();
  await activate(client);
  const before = await repo.allRatings();
  client.failSnapshot = true;
  await assert.rejects(() => repo.setRating('movie-42', 2), /synthetic backend unavailable/);
  assert.deepEqual(await repo.allRatings(), before);
});

test('backend cache cannot be reset to demo fixtures', async () => {
  const client = new Client();
  await activate(client);
  await assert.rejects(() => repo.resetToFixtures(), /disabled while Worker\/D1 is the durable source/);
  assert.equal((await repo.backendCacheInfo()).active, true);
});
