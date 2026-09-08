import * as db from './db.js';
import type { BackendMigrationBundle, BackendSnapshot } from './backend-contract.js';
import type { MigrationBackendClient } from './backend-client.js';
import type {
  AlertRecord,
  AvailabilityEntry,
  Episode,
  LibraryItem,
  Rating,
  Season,
  ServiceDef,
  SyncState,
  Title,
  TitleMetadata,
  WatchEvent,
  WatchOverride,
  WatchedService
} from './types.js';

const MIGRATION_ID_KEY = 'backend_migration_id_v1';
const DATA_SOURCE_KEY = 'data_source';
const BACKEND_SNAPSHOT_AT_KEY = 'backend_snapshot_generated_at';

function stableRows<T>(rows: T[], key: (row: T) => string): T[] {
  return [...rows].sort((a, b) => key(a).localeCompare(key(b)));
}

function comparableUserState(snapshot: BackendSnapshot): string {
  return JSON.stringify({
    library: stableRows(snapshot.library, (row) => row.titleId),
    ratings: stableRows(snapshot.ratings, (row) => row.titleId),
    watchedService: stableRows(snapshot.watchedService, (row) => row.titleId),
    watchEvents: stableRows(snapshot.watchEvents, (row) => `${row.providerEventId}\u0000${row.id}`),
    watchOverrides: stableRows(snapshot.watchOverrides, (row) => `${row.scopeType}\u0000${row.titleId}\u0000${row.seasonNumber ?? -1}\u0000${row.episodeNumber ?? -1}\u0000${row.id}`),
    selectedServices: stableRows(snapshot.services.filter((row) => row.userSelected), (row) => row.serviceKey)
      .map(({ serviceKey, displayName, logoGlyph, userSelected, availabilitySource }) => ({ serviceKey, displayName, logoGlyph, userSelected, availabilitySource })),
    alerts: stableRows(snapshot.alerts, (row) => row.id)
      .map(({ id, titleId, alertType, message, eventDate, createdAt, seenAt, dedupeKey }) => ({ id, titleId, alertType, message, eventDate, createdAt, seenAt, dedupeKey }))
  });
}

async function readLocalSnapshot(now = new Date()): Promise<BackendSnapshot> {
  const [titles, metadata, seasons, episodes, watchEvents, watchOverrides, library, ratings,
    watchedService, services, availability, alerts, syncState] = await Promise.all([
    db.getAll<Title>('titles'),
    db.getAll<TitleMetadata>('title_metadata'),
    db.getAll<Season>('seasons'),
    db.getAll<Episode>('episodes'),
    db.getAll<WatchEvent>('watch_events'),
    db.getAll<WatchOverride>('watch_overrides'),
    db.getAll<LibraryItem>('library_items'),
    db.getAll<Rating>('ratings'),
    db.getAll<WatchedService>('watched_service'),
    db.getAll<ServiceDef>('services'),
    db.getAll<AvailabilityEntry>('availability'),
    db.getAll<AlertRecord>('alerts'),
    db.getAll<SyncState>('sync_state')
  ]);
  return {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    titles, metadata, seasons, episodes, watchEvents, watchOverrides, library, ratings,
    watchedService, services, availability, alerts, syncState
  };
}

async function pendingMigrationId(): Promise<string> {
  const existing = await db.get<{ key: string; value: string }>('meta', MIGRATION_ID_KEY);
  if (existing?.value) return existing.value;
  const value = crypto.randomUUID();
  await db.put('meta', { key: MIGRATION_ID_KEY, value });
  return value;
}

function replacementRows(snapshot: BackendSnapshot) {
  return [
    { store: 'titles' as const, values: snapshot.titles },
    { store: 'title_metadata' as const, values: snapshot.metadata },
    { store: 'seasons' as const, values: snapshot.seasons },
    { store: 'episodes' as const, values: snapshot.episodes },
    { store: 'watch_events' as const, values: snapshot.watchEvents },
    { store: 'watch_overrides' as const, values: snapshot.watchOverrides },
    { store: 'library_items' as const, values: snapshot.library },
    { store: 'ratings' as const, values: snapshot.ratings },
    { store: 'watched_service' as const, values: snapshot.watchedService },
    { store: 'services' as const, values: snapshot.services },
    { store: 'availability' as const, values: snapshot.availability },
    { store: 'alerts' as const, values: snapshot.alerts },
    { store: 'sync_state' as const, values: snapshot.syncState },
    { store: 'meta' as const, values: [
      { key: DATA_SOURCE_KEY, value: 'backend' },
      { key: BACKEND_SNAPSHOT_AT_KEY, value: snapshot.generatedAt }
    ] }
  ];
}

export async function migrationStatus(): Promise<{ pendingMigrationId: string | null }> {
  const row = await db.get<{ key: string; value: string }>('meta', MIGRATION_ID_KEY);
  return { pendingMigrationId: row?.value ?? null };
}

/** Import the current cache exactly once, verify the durable round trip, then atomically switch
 * IndexedDB to the authenticated D1 snapshot. If import or verification fails, the existing local
 * cache remains untouched and the persisted migration id makes the next attempt safe to retry. */
export async function migrateLocalStateToBackend(client: MigrationBackendClient): Promise<{ alreadyApplied: boolean; generatedAt: string }> {
  const source = await db.get<{ key: string; value: string }>('meta', DATA_SOURCE_KEY);
  if (source?.value === 'backend') {
    const snapshot = await client.getSnapshot();
    await db.replaceStores(replacementRows(snapshot));
    return { alreadyApplied: true, generatedAt: snapshot.generatedAt };
  }

  const local = await readLocalSnapshot();
  const migrationId = await pendingMigrationId();
  const bundle: BackendMigrationBundle = { migrationId, snapshot: local };
  const imported = await client.importLocalState(bundle);
  const remote = await client.getSnapshot();

  if (remote.schemaVersion !== 1 || !remote.generatedAt || Number.isNaN(Date.parse(remote.generatedAt))) {
    throw new Error('Backend returned an invalid snapshot after local-state migration');
  }
  if (comparableUserState(local) !== comparableUserState(remote)) {
    throw new Error('Backend migration verification failed: durable user state does not match the local source');
  }

  await db.replaceStores(replacementRows(remote));
  return { alreadyApplied: imported.alreadyApplied, generatedAt: remote.generatedAt };
}
