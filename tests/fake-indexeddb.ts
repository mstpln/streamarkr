// Correction 15: a minimal, test-owned in-memory polyfill for the narrow slice of IndexedDB that
// src/lib/db.ts actually uses (open/upgrade with keyPaths, get/getAll/put/delete/clear per store,
// no cursors, no indexes, no range queries). This lets us run a real integration test against the
// actual repo.ts + db.ts code path without depending on any external package (the previously
// blocked `fake-indexeddb` npm package is unavailable in this offline environment).
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
  error: any = null;
  constructor(private db: FakeIDBDatabase) {
    // Real IndexedDB transactions auto-commit once the current task (and its microtasks) finish
    // with no further requests queued. db.ts only ever issues its request(s) synchronously right
    // after creating the transaction, so a couple of microtask turns is a faithful-enough model.
    queueMicrotask(() => queueMicrotask(() => queueMicrotask(() => { this.oncomplete?.(); })));
  }
  objectStore(name: string): FakeObjectStore {
    const def = this.db.tables.get(name)!;
    return new FakeObjectStore(def.data, def.keyPath);
  }
}

class FakeIDBDatabase {
  tables = new Map<string, { keyPath: KeyPath; data: Map<string, any> }>();
  get objectStoreNames() {
    return { contains: (name: string) => this.tables.has(name) };
  }
  createObjectStore(name: string, opts: { keyPath: KeyPath }) {
    this.tables.set(name, { keyPath: opts.keyPath, data: new Map() });
  }
  transaction(_names: string[], _mode: string): FakeTransaction {
    return new FakeTransaction(this);
  }
}

class FakeIDBOpenRequest {
  onsuccess: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onupgradeneeded: (() => void) | null = null;
  result: FakeIDBDatabase;
  error: any = null;
  constructor(db: FakeIDBDatabase) { this.result = db; }
}

class FakeIDBFactory {
  private dbs = new Map<string, FakeIDBDatabase>();
  open(name: string, _version: number): FakeIDBOpenRequest {
    let isNew = false;
    let db = this.dbs.get(name);
    if (!db) { db = new FakeIDBDatabase(); this.dbs.set(name, db); isNew = true; }
    const req = new FakeIDBOpenRequest(db);
    queueMicrotask(() => {
      if (isNew) req.onupgradeneeded?.();
      req.onsuccess?.();
    });
    return req;
  }
}

/** Installs a fresh fake indexedDB global. Call before importing/using src/lib/db.ts's cached
 * connection in a given test — pair with resetting db.ts's module-level cache (see repo.test.ts). */
export function installFakeIndexedDB(): void {
  (globalThis as any).indexedDB = new FakeIDBFactory();
}
