import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installFakeIndexedDBV1 } from './fake-indexeddb.js';

installFakeIndexedDBV1();
const db = await import('../src/lib/db.js');

test('IndexedDB v1 to v2 migration preserves user-owned stores and recreates availability only', async () => {
  // Opening db.ts at DB_VERSION=2 triggers the synthetic v1 -> v2 upgrade.
  await db.openDb();

  const library = await db.getAll<any>('library_items');
  const ratings = await db.getAll<any>('ratings');
  const availability = await db.getAll<any>('availability');

  assert.equal(library.length, 1);
  assert.equal(library[0]?.titleId, 'movie-preserved');
  assert.equal(ratings.length, 1);
  assert.equal(ratings[0]?.stars, 4);
  assert.equal(availability.length, 0);

  // The recreated v2 availability store must accept simultaneous option types for one service.
  await db.put('availability', { titleId: 'movie-preserved', serviceKey: 'netflix', optionType: 'subscription' });
  await db.put('availability', { titleId: 'movie-preserved', serviceKey: 'netflix', optionType: 'rent' });
  const migratedAvailability = await db.getAll<any>('availability');
  assert.equal(migratedAvailability.length, 2);
});
