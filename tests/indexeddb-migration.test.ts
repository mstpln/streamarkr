import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installFakeIndexedDBV1 } from './fake-indexeddb.js';

installFakeIndexedDBV1();
const db = await import('../src/lib/db.js');
const repo = await import('../src/lib/repo.js');

test('IndexedDB v1 to v2 migration preserves user-owned stores and refills only invalidated synthetic availability', async () => {
  // Opening db.ts at DB_VERSION=2 triggers the synthetic v1 -> v2 upgrade. ensureSeeded then sees
  // the persistent invalidation marker and refills provider-owned fixture availability exactly once.
  await db.openDb();
  assert.equal((await db.getAll<any>('availability')).length, 0);
  assert.equal((await db.get<any>('meta', db.AVAILABILITY_CACHE_INVALIDATED_KEY))?.value, true);

  await repo.ensureSeeded();

  const library = await db.getAll<any>('library_items');
  const ratings = await db.getAll<any>('ratings');
  const availability = await db.getAll<any>('availability');

  assert.equal(library.length, 1);
  assert.equal(library[0]?.titleId, 'movie-preserved');
  assert.equal(ratings.length, 1);
  assert.equal(ratings[0]?.stars, 4);
  assert.ok(availability.length > 0);
  assert.equal(await db.get('meta', db.AVAILABILITY_CACHE_INVALIDATED_KEY), undefined);

  // The recreated v2 store must retain simultaneous option types for one title/service.
  await db.put('availability', { titleId: 'movie-preserved', serviceKey: 'netflix', optionType: 'subscription' });
  await db.put('availability', { titleId: 'movie-preserved', serviceKey: 'netflix', optionType: 'rent' });
  const preservedOptions = (await db.getAll<any>('availability')).filter((row) => row.titleId === 'movie-preserved' && row.serviceKey === 'netflix');
  assert.equal(preservedOptions.length, 2);
});
