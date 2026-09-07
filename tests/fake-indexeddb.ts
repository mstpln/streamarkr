// Minimal, test-owned in-memory polyfill for the narrow slice of IndexedDB that src/lib/db.ts
// uses: versioned open/upgrade, keyPath stores, get/getAll/put/delete/clear, store deletion and
// transactions. No cursors, indexes or range queries.
type KeyPath = string | string[];

function extractKey(keyPath: KeyPath, value: any): string {
  if (Array.isArray(keyPath)) return JSON.stringify(keyPath.map((k) => value[k]));
  return JSON.stringify(value[keyPath]);
}
function normalizeKey(key: any): string {
  return JSON.stringify(key);
}

class FakeRequest {
  onsuccess: (() => void) | null = null;
  onerror: (() => void) | null = null;
  result: any;
  error: any = null;
}

class FakeObjectStore {
  constructor(private table: Map<string, any>, private keyPath: KeyPath) {}
  getAll(): FakeRequest {
    const req = new FakeRequest();
    queueMicrotask(() => { req.result = [...this.table.values()]; req.onsuccess?.(); });
    return req;
  }
  get(key: any): FakeRequest {
    const req = new FakeRequest();
    queueMicrotask(() => { req.result = this.table.get(normalizeKey(key)); req.onsuccess?.(); });
    return req;
  }
  put(value: any): FakeRequest {
    const req = new FakeRequest();
    this.table.set(extractKey(this.keyPath, value), value);
    queueMicrotask(() => { req.onsuccess?.(); });
    return req;
  }
  delete(key: any): FakeRequest {
    const req = new FakeRequest();
    this.table.delete(normalizeKey(key));
    queueMicrotask(() => { req.onsuccess?.(); });
    return req;
  }
  clear(): FakeRequest {
    const req = new FakeRequest();
    this.table.clear();
    queueMicrotask(() => { req.onsuccess?.(); });
    return req;
  }
}

class FakeTransaction {
  oncomplete: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  error: any = null;
  private aborted = false;

  constructor(private db: FakeIDBDatabase, autoComplete = true) {
    if (autoComplete) {
      queueMicrotask(() => queueMicrotask(() => queueMicrotask(() => {
        if (!this.aborted) this.oncomplete?.();
      })));
    }
  }
  objectStore(name: string): FakeObjectStore {
    const def = this.db.tables.get(name);
    if (!def) throw new Error(`Missing fake IndexedDB store: ${name}`);
    return new FakeObjectStore(def.data, def.keyPath);
  }
  abort(): void {
    this.aborted = true;
    queueMicrotask(() => this.onabort?.());
  }
}

class FakeIDBDatabase {
  version = 0;
  tables = new Map<string, { keyPath: KeyPath; data: Map<string, any> }>();
  get objectStoreNames() {
    return { contains: (name: string) => this.tables.has(name) };
  }
  createObjectStore(name: string, opts: { keyPath: KeyPath }) {
    this.tables.set(name, { keyPath: opts.keyPath, data: new Map() });
  }
  deleteObjectStore(name: string) {
    this.tables.delete(name);
  }
  transaction(_names: string[], _mode: string): FakeTransaction {
    return new FakeTransaction(this);
  }
  seedStore(name: string, keyPath: KeyPath, values: any[]) {
    const data = new Map<string, any>();
    for (const value of values) data.set(extractKey(keyPath, value), value);
    this.tables.set(name, { keyPath, data });
  }
}

class FakeIDBOpenRequest {
  onsuccess: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onupgradeneeded: ((event: any) => void) | null = null;
  result: FakeIDBDatabase;
  transaction: FakeTransaction | null = null;
  error: any = null;
  constructor(db: FakeIDBDatabase) { this.result = db; }
}

class FakeIDBFactory {
  private dbs = new Map<string, FakeIDBDatabase>();
  constructor(seedV1 = false) {
    if (seedV1) {
      const db = new FakeIDBDatabase();
      db.version = 1;
      db.seedStore('library_items', 'titleId', [
        { titleId: 'movie-preserved', addedAt: '2026-09-01T00:00:00.000Z', derivedStatus: 'To Watch', statusComputedAt: '2026-09-01T00:00:00.000Z' }
      ]);
      db.seedStore('ratings', 'titleId', [
        { titleId: 'movie-preserved', stars: 4, ratedAt: '2026-09-01T00:01:00.000Z' }
      ]);
      db.seedStore('availability', ['titleId', 'serviceKey'], [
        { titleId: 'movie-stale', serviceKey: 'netflix', optionType: 'subscription' }
      ]);
      // v0.13 and older caches had the seed flag but no data_source provenance marker.
      db.seedStore('meta', 'key', [{ key: 'seeded_v1', value: true }]);
      this.dbs.set('streamarkr', db);
    }
  }
  open(name: string, version: number): FakeIDBOpenRequest {
    let db = this.dbs.get(name);
    if (!db) { db = new FakeIDBDatabase(); this.dbs.set(name, db); }
    const oldVersion = db.version;
    const req = new FakeIDBOpenRequest(db);
    queueMicrotask(() => {
      if (version > oldVersion) {
        req.transaction = new FakeTransaction(db!, false);
        req.onupgradeneeded?.({ oldVersion, newVersion: version });
        db!.version = version;
        req.transaction = null;
      }
      req.onsuccess?.();
    });
    return req;
  }
}

/** Installs a fresh empty fake IndexedDB global. Call before importing/using src/lib/db.ts's
 * cached connection in a given test process. */
export function installFakeIndexedDB(): void {
  (globalThis as any).indexedDB = new FakeIDBFactory();
}

/** Installs a synthetic legacy v1 Streamarkr database containing user-owned rows, a seed flag and
 * stale provider availability, but no newer data_source provenance marker. */
export function installFakeIndexedDBV1(): void {
  (globalThis as any).indexedDB = new FakeIDBFactory(true);
}
