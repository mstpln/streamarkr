// Local "D1" replacement. One IndexedDB object store per table from the build plan's data
// model (section 9). Keeps the same ownership boundaries: user-owned stores (library_items,
// ratings, watch_overrides, watched_service, alerts, services) are never touched by provider
// refresh code paths — only by repo.ts functions that represent explicit user actions.

const DB_NAME = 'streamarkr';
const DB_VERSION = 1;

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
  availability: ['titleId', 'serviceKey'],
  alerts: 'id',
  sync_state: 'syncType',
  meta: 'key'
};

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: KEY_PATHS[name] as any });
        }
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
