// IndexedDB is the browser-side cache/offline layer. D1 is the target durable source of truth,
// but UI/domain code continues to read through repo.ts so cached-first rendering works offline.
// User-owned local-only stores must never be overwritten by provider refresh paths.

const DB_NAME = 'streamarkr';
const DB_VERSION = 2;
export const AVAILABILITY_CACHE_INVALIDATED_KEY = 'availability_cache_invalidated_v2';

export const STORES = [
  'titles',
  'title_metadata',
  'seasons',
  'episodes',
  'watch_events',
  'watch_overrides',
  'library_items',
  'ratings',
  'watched_service',
  'services',
  'availability',
  'alerts',
  'sync_state',
  'meta'
] as const;

export type StoreName = (typeof STORES)[number];

const KEY_PATHS: Record<StoreName, string | string[]> = {
  titles: 'id',
  title_metadata: 'titleId',
  seasons: ['titleId', 'seasonNumber'],
  episodes: ['titleId', 'seasonNumber', 'episodeNumber'],
  watch_events: 'id',
  watch_overrides: 'id',
  library_items: 'titleId',
  ratings: 'titleId',
  watched_service: 'titleId',
  services: 'serviceKey',
  availability: ['titleId', 'serviceKey', 'optionType'],
  alerts: 'id',
  sync_state: 'syncType',
  meta: 'key'
};

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldVersion = (event as IDBVersionChangeEvent).oldVersion;
      let availabilityCacheInvalidated = false;

      // v1 used [titleId, serviceKey], which could not retain simultaneous subscription/rent/buy
      // rows. Availability is provider-owned cache data, so deleting/recreating only this store is
      // the safe migration; user-owned stores are preserved intact.
      if (oldVersion > 0 && oldVersion < 2 && db.objectStoreNames.contains('availability')) {
        db.deleteObjectStore('availability');
        availabilityCacheInvalidated = true;
      }

      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: KEY_PATHS[name] as any });
        }
      }

      // Record invalidation inside the same versionchange transaction as the store recreation.
      // If this write cannot commit, the schema upgrade itself rolls back instead of leaving a v2
      // database with an empty availability cache and no marker telling synthetic mode to refill it.
      if (availabilityCacheInvalidated) {
        const upgradeTransaction = req.transaction;
        if (!upgradeTransaction) throw new Error('IndexedDB upgrade transaction unavailable');
        upgradeTransaction.objectStore('meta').put({ key: AVAILABILITY_CACHE_INVALIDATED_KEY, value: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(db: IDBDatabase, stores: StoreName[], mode: IDBTransactionMode) {
  return db.transaction(stores as string[], mode);
}

function assertReplacementKeys(replacements: Array<{ store: StoreName; values: unknown[] }>): void {
  for (const replacement of replacements) {
    const keyPath = KEY_PATHS[replacement.store];
    const keys = Array.isArray(keyPath) ? keyPath : [keyPath];
    for (const value of replacement.values) {
      if (typeof value !== 'object' || value === null) {
        throw new Error(`Invalid ${replacement.store} cache row: expected an object`);
      }
      const row = value as Record<string, unknown>;
      for (const key of keys) {
        if (row[key] === undefined || row[key] === null) {
          throw new Error(`Invalid ${replacement.store} cache row: missing key field ${key}`);
        }
      }
    }
  }
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = tx(db, [store], 'readonly').objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

export async function get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = tx(db, [store], 'readonly').objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function put<T>(store: StoreName, value: T): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = tx(db, [store], 'readwrite');
    t.objectStore(store).put(value as any);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function putAll<T>(store: StoreName, values: T[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = tx(db, [store], 'readwrite');
    const os = t.objectStore(store);
    for (const v of values) os.put(v as any);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function replaceStores(replacements: Array<{ store: StoreName; values: unknown[] }>): Promise<void> {
  if (replacements.length === 0) return;
  // Validate all key-path fields before opening a write transaction. This prevents a malformed
  // snapshot from clearing any existing cache rows before IndexedDB reports a key error.
  assertReplacementKeys(replacements);

  const db = await openDb();
  const stores = [...new Set(replacements.map((replacement) => replacement.store))];
  return new Promise((resolve, reject) => {
    const t = tx(db, stores, 'readwrite');
    let schedulingError: unknown;

    t.oncomplete = () => resolve();
    // Request-level IndexedDB errors abort a normal readwrite transaction. Wait for onabort before
    // rejecting so callers cannot observe the cache until the rollback has completed.
    t.onerror = () => undefined;
    t.onabort = () => reject(schedulingError ?? t.error ?? new Error('IndexedDB cache replacement aborted'));

    try {
      for (const replacement of replacements) {
        const os = t.objectStore(replacement.store);
        os.clear();
        for (const value of replacement.values) os.put(value as any);
      }
    } catch (error) {
      schedulingError = error;
      try {
        t.abort();
      } catch {
        reject(error);
      }
    }
  });
}

export async function del(store: StoreName, key: IDBValidKey): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = tx(db, [store], 'readwrite');
    t.objectStore(store).delete(key);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function clearAll(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = tx(db, STORES as unknown as StoreName[], 'readwrite');
    for (const s of STORES) t.objectStore(s).clear();
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

/** True when any real cache/data store contains rows. Browser-only meta markers do not count;
 * this is used to distinguish a genuinely empty cache from legacy v1 installs that predate the
 * data_source marker and therefore still require explicit migration/reset before backend takeover. */
export async function hasAnyData(): Promise<boolean> {
  const dataStores = STORES.filter((store): store is Exclude<StoreName, 'meta'> => store !== 'meta');
  const rows = await Promise.all(dataStores.map((store) => getAll(store)));
  return rows.some((values) => values.length > 0);
}

export async function countAny(): Promise<number> {
  const titles = await getAll('titles');
  return titles.length;
}
