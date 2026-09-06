// Canonical domain types. Mirrors the table boundaries from the build plan so a real
// Cloudflare Worker + D1 backend could later replace the local IndexedDB repo without
// changing call sites.

export type MediaType = 'series' | 'movie';

export interface Title {
  id: string; // canonical id: `${mediaType}-${tmdbId}`
  mediaType: MediaType;
  tmdbId: number;
  traktId?: number;
  imdbId?: string;
  availabilityId?: string;
  title: string;
  year: number;
}

export interface TitleMetadata {
  titleId: string;
  status: 'Returning Series' | 'Ended' | 'Canceled' | 'Released' | 'Upcoming' | 'In Production';
  overview: string;
  genres: string[];
  posterPath: string; // css gradient key into our fake artwork palette
  backdropPath: string;
  trailerKey: string | null;
  metadataUpdatedAt: string;
  /** Movies only: known release date, or null if not yet announced. Distinct from streaming
   * availability — this is the general release-date concept the alert engine tracks for
   * announced/changed/delayed/moved-earlier alerts (section 11 / Appendix "release-date
   * semantics for movies"). */
  releaseDate?: string | null;
}

export interface Season {
  titleId: string;
  seasonNumber: number;
  tmdbSeasonId: number;
  name: string;
  episodeCount: number;
  airDate: string | null;
}

export interface Episode {
  titleId: string;
  seasonNumber: number;
  episodeNumber: number;
  tmdbEpisodeId: number;
  name: string;
  runtime: number | null;
  airDate: string | null; // ISO date, null = unknown
  overview: string;
}

export type WatchScope =
  | { type: 'movie'; titleId: string }
  | { type: 'episode'; titleId: string; seasonNumber: number; episodeNumber: number };

export interface WatchEvent {
  id: string;
  providerEventId: string;
  titleId: string;
  seasonNumber?: number;
  episodeNumber?: number;
  watchedAt: string; // ISO timestamp, always real (provider-sourced)
  source: 'trakt';
}

export interface WatchOverride {
  id: string;
  scopeType: 'movie' | 'episode' | 'season';
  titleId: string;
  seasonNumber?: number;
  episodeNumber?: number;
  state: 'watched' | 'unwatched';
  changedAt: string; // ISO timestamp of the correction itself, never fabricated as a watch date
}

export interface LibraryItem {
  titleId: string;
  addedAt: string;
  derivedStatus: SeriesStatus | MovieStatus;
  statusComputedAt: string;
}

export interface Rating {
  titleId: string;
  stars: 1 | 2 | 3 | 4 | 5;
  ratedAt: string;
}

export interface WatchedService {
  titleId: string;
  serviceKey: string; // "where I watched it" — must be one of the user-selected services
  changedAt: string;
}

export interface ServiceDef {
  serviceKey: string;
  displayName: string;
  logoGlyph: string; // short glyph/initial used in the fake logo badge
  userSelected: boolean;
  availabilitySource: 'streaming-availability' | 'tmdb-fallback' | 'unsupported';
}

export interface AvailabilityEntry {
  titleId: string;
  serviceKey: string;
  optionType: 'subscription' | 'rent' | 'buy';
  deepLink: string | null;
  startsAt: string | null;
  endsAt: string | null; // "leaving soon" when set and within 30 days
  checkedAt: string;
  source: 'streaming-availability' | 'tmdb-fallback';
}

export type AlertType =
  | 'new_season_announced'
  | 'new_season_available'
  | 'new_episode_available'
  | 'now_available'
  | 'leaving_soon'
  | 'movie_release_announced'
  | 'movie_release_changed';

export interface AlertRecord {
  id: string;
  titleId: string;
  alertType: AlertType;
  message: string;
  eventDate: string | null;
  createdAt: string;
  seenAt: string | null;
  dedupeKey: string;
}

export type SeriesStatus = 'To Watch' | 'Watching' | 'On Hold' | 'Caught Up' | 'Finished';
export type MovieStatus = 'To Watch' | 'Finished';

export interface SyncState {
  syncType: 'trakt' | 'metadata' | 'availability';
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
}
