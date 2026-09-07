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
