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

export interface BackendSnapshot {
  schemaVersion: number;
  generatedAt: string;
  titles: Title[];
  metadata: TitleMetadata[];
  seasons: Season[];
  episodes: Episode[];
  watchEvents: WatchEvent[];
  watchOverrides: WatchOverride[];
  library: LibraryItem[];
  ratings: Rating[];
  watchedService: WatchedService[];
  services: ServiceDef[];
  availability: AvailabilityEntry[];
  alerts: AlertRecord[];
  syncState: SyncState[];
}

/** One retry-safe browser-to-D1 takeover payload. The migrationId is created and persisted in
 * IndexedDB before the first network attempt, so a lost response can be retried without creating a
 * second migration identity or risking a second independent import. */
export interface BackendMigrationBundle {
  migrationId: string;
  snapshot: BackendSnapshot;
}
