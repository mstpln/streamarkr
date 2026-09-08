import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installFakeIndexedDB } from './fake-indexeddb.js';
import type { BackendMigrationBundle, BackendSnapshot } from '../src/lib/backend-contract.js';
import type { MigrationBackendClient } from '../src/lib/backend-client.js';

installFakeIndexedDB();
const db = await import('../src/lib/db.js');
const repo = await import('../src/lib/repo.js');
const { migrateLocalStateToBackend, migrationStatus } = await import('../src/lib/backend-migration.js');

class MigrationClient implements MigrationBackendClient {
  imported: BackendMigrationBundle[] = [];
  failImport = false;
  mutateRemote: ((snapshot: BackendSnapshot) => BackendSnapshot) | null = null;

  async importLocalState(bundle: BackendMigrationBundle): Promise<{ alreadyApplied: boolean }> {
    this.imported.push(bundle);
    if (this.failImport) throw new Error('synthetic migration network failure');
    return { alreadyApplied: this.imported.length > 1 };
  }
  async getSnapshot(): Promise<BackendSnapshot> {
    const source = this.imported.at(-1)?.snapshot;
    if (!source) throw new Error('no imported snapshot');
    const remote: BackendSnapshot = { ...structuredClone(source), generatedAt: '2026-09-08T10:00:00.000Z' };
    return this.mutateRemote ? this.mutateRemote(remote) : remote;
  }
  async addToLibrary() {}
  async removeFromLibrary() {}
  async setRating() {}
  async clearRating() {}
  async setWatchedService() {}
  async setMovieOverride() {}
  async setEpisodeOverride() {}
  async setSeasonOverride() { return { affectedEpisodes: 0 }; }
  async setServiceSelected() {}
  async addCustomService() { return { serviceKey: 'synthetic' }; }
  async markAlertsSeen() {}
}

async function seedLocal(): Promise<void> {
  repo.configureBackendClient(null);
  await db.clearAll();
  await repo.ensureSeeded();
}

test('failed migration keeps local data intact and persists one retry identity', async () => {
  await seedLocal();
  const beforeLibrary = await repo.allLibrary();
  const client = new MigrationClient();
  client.failImport = true;

  await assert.rejects(() => migrateLocalStateToBackend(client), /synthetic migration network failure/);
  const firstId = (await migrationStatus()).pendingMigrationId;
  assert.match(firstId ?? '', /^[0-9a-f-]{36}$/i);
  assert.equal((await repo.backendCacheInfo()).active, false);
  assert.deepEqual(await repo.allLibrary(), beforeLibrary);

  client.failImport = false;
  await migrateLocalStateToBackend(client);
  assert.equal(client.imported.at(-1)?.migrationId, firstId);
  assert.equal((await repo.backendCacheInfo()).active, true);
});

test('successful migration verifies durable user state before atomically activating backend cache', async () => {
  await seedLocal();
  const client = new MigrationClient();
  const result = await migrateLocalStateToBackend(client);

  assert.equal(result.alreadyApplied, false);
  assert.equal(result.generatedAt, '2026-09-08T10:00:00.000Z');
  assert.equal(client.imported.length, 1);
  assert.equal((await repo.backendCacheInfo()).active, true);
  assert.deepEqual((await repo.allLibrary()).map((row) => row.titleId).sort(), client.imported[0].snapshot.library.map((row) => row.titleId).sort());
  assert.equal((await migrationStatus()).pendingMigrationId, null);
});

test('round-trip mismatch refuses takeover and preserves the local source for recovery', async () => {
  await seedLocal();
  const beforeRatings = await repo.allRatings();
  const client = new MigrationClient();
  client.mutateRemote = (snapshot) => ({ ...snapshot, ratings: [] });

  await assert.rejects(() => migrateLocalStateToBackend(client), /durable user state does not match/);
  assert.equal((await repo.backendCacheInfo()).active, false);
  assert.deepEqual(await repo.allRatings(), beforeRatings);
  assert.ok((await migrationStatus()).pendingMigrationId);
});

test('already-active migration path refreshes verified cache without uploading local state again', async () => {
  await seedLocal();
  const client = new MigrationClient();
  await migrateLocalStateToBackend(client);
  assert.equal(client.imported.length, 1);

  const result = await migrateLocalStateToBackend(client);
  assert.equal(result.alreadyApplied, true);
  assert.equal(client.imported.length, 1);
  assert.equal((await repo.backendCacheInfo()).active, true);
});
