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
    let availabilityCacheInvalidated = false;
    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldVersion = (event as IDBVersionChangeEvent).oldVersion;

      // v1 used [titleId, serviceKey], which could not retain simultaneous subscription/rent/buy
      // rows. Availability is provider-owned cache data, so deleting/recreating only this store is
      // the safe migration; user-owned stores are preserved intact. Persist an invalidation marker
      // after upgrade so synthetic mode can refill this cache exactly once instead of silently
      // losing availability while the old seeded_v1 flag remains true.
      if (oldVersion > 0 && oldVersion < 2 && db.objectStoreNames.contains('availability')) {
        db.deleteObjectStore('availability');
        availabilityCacheInvalidated = true;
      }

      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: KEY_PATHS[name] as any });
        }
      }
    };
    req.onsuccess = () => {
      if (!availabilityCacheInvalidated) {
        resolve(req.result);
        return;
      }
      const t = req.result.transaction(['meta'], 'readwrite');
      t.objectStore('meta').put({ key: AVAILABILITY_CACHE_INVALIDATED_KEY, value: true });
      t.oncomplete = () => resolve(req.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error ?? new Error('IndexedDB availability migration marker aborted'));
    };
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(db: IDBDatabase, stores: StoreName[], mode: IDBTransactionMode) {
  return db.transaction(stores as string[], mode);
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
  const db = await openDb();
  const stores = [...new Set(replacements.map((replacement) => replacement.store))];
  return new Promise((resolve, reject) => {
    const t = tx(db, stores, 'readwrite');
    for (const replacement of replacements) {
      const os = t.objectStore(replacement.store);
      os.clear();
      for (const value of replacement.values) os.put(value as any);
    }
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error ?? new Error('IndexedDB cache replacement failed'));
    t.onabort = () => reject(t.error ?? new Error('IndexedDB cache replacement aborted'));
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

export async function countAny(): Promise<number> {
  const titles = await getAll('titles');
  return titles.length;
}
