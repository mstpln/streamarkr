import type { BackendMigrationBundle, BackendSnapshot } from '../src/lib/backend-contract.js';
import type { D1Database, D1PreparedStatement, D1Primitive } from './types.js';

const MIGRATION_META_KEY = 'local_state_migration_id';
const BUILT_IN_SERVICES = [
  'netflix', 'hbo-max', 'disney-plus', 'prime-video', 'skyshowtime', 'apple-tv', 'viaplay', 'tv4-play'
] as const;
const TITLE_STATUSES = ['Returning Series', 'Ended', 'Canceled', 'Released', 'Upcoming', 'In Production'] as const;
const LIBRARY_STATUSES = ['To Watch', 'Watching', 'On Hold', 'Caught Up', 'Finished'] as const;
const ALERT_TYPES = [
  'new_season_announced', 'new_season_available', 'new_episode_available', 'now_available', 'leaving_soon',
  'movie_release_announced', 'movie_release_changed'
] as const;

export class MigrationConflictError extends Error {
  constructor(message = 'Backend already contains state from another activation') {
    super(message);
    this.name = 'MigrationConflictError';
  }
}

export class InvalidMigrationPayloadError extends Error {
  constructor(message = 'Invalid local-state migration payload') {
    super(message);
    this.name = 'InvalidMigrationPayloadError';
  }
}

function finiteInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}
function text(value: unknown, max = 10000): value is string {
  return typeof value === 'string' && value.length <= max;
}
function iso(value: unknown): value is string {
  return text(value, 100) && !Number.isNaN(Date.parse(value));
}
function nullableIso(value: unknown): value is string | null {
  return value === null || iso(value);
}
function optionalText(value: unknown, max = 10000): value is string | null | undefined {
  return value == null || text(value, max);
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function rows(value: unknown, limit: number): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.length <= limit && value.every(object);
}
function canonicalTitleId(value: unknown): value is string {
  return text(value, 100) && /^(movie|series)-\d+$/.test(value);
}

function assertSnapshot(snapshot: unknown): asserts snapshot is BackendSnapshot {
  if (!object(snapshot) || snapshot.schemaVersion !== 1 || !iso(snapshot.generatedAt)) {
    throw new InvalidMigrationPayloadError();
  }
  const limits: Array<[keyof BackendSnapshot, number]> = [
    ['titles', 10000], ['metadata', 10000], ['seasons', 30000], ['episodes', 150000],
    ['watchEvents', 250000], ['watchOverrides', 250000], ['library', 10000], ['ratings', 10000],
    ['watchedService', 10000], ['services', 100], ['availability', 150000], ['alerts', 30], ['syncState', 3]
  ];
  for (const [key, limit] of limits) {
    if (!rows(snapshot[key], limit)) throw new InvalidMigrationPayloadError(`Invalid migration rows: ${key}`);
  }

  const typed = snapshot as unknown as BackendSnapshot;

  for (const title of typed.titles) {
    if (!canonicalTitleId(title.id) ||
        (title.mediaType !== 'movie' && title.mediaType !== 'series') || !finiteInteger(title.tmdbId) || title.tmdbId <= 0 ||
        !text(title.title, 1000) || !finiteInteger(title.year) || title.year < 1800 || title.year > 3000 ||
        title.id !== `${title.mediaType}-${title.tmdbId}` ||
        (title.traktId !== undefined && (!finiteInteger(title.traktId) || title.traktId <= 0)) ||
        !optionalText(title.imdbId, 100) || !optionalText(title.availabilityId, 200)) {
      throw new InvalidMigrationPayloadError('Invalid canonical title row');
    }
  }
  for (const row of typed.metadata) {
    if (!canonicalTitleId(row.titleId) || !TITLE_STATUSES.includes(row.status) || !text(row.overview, 20000) ||
        !Array.isArray(row.genres) || row.genres.length > 100 || !row.genres.every((genre) => text(genre, 100)) ||
        !text(row.posterPath, 1000) || !text(row.backdropPath, 1000) || !optionalText(row.trailerKey, 500) ||
        !iso(row.metadataUpdatedAt) || (row.releaseDate !== undefined && !nullableIso(row.releaseDate))) {
      throw new InvalidMigrationPayloadError('Invalid title metadata row');
    }
  }
  for (const row of typed.seasons) {
    if (!canonicalTitleId(row.titleId) || !finiteInteger(row.seasonNumber) || row.seasonNumber < 0 ||
        !finiteInteger(row.tmdbSeasonId) || row.tmdbSeasonId <= 0 || !text(row.name, 1000) ||
        !finiteInteger(row.episodeCount) || row.episodeCount < 0 || !nullableIso(row.airDate)) {
      throw new InvalidMigrationPayloadError('Invalid season row');
    }
  }
  for (const row of typed.episodes) {
    if (!canonicalTitleId(row.titleId) || !finiteInteger(row.seasonNumber) || row.seasonNumber < 0 ||
        !finiteInteger(row.episodeNumber) || row.episodeNumber <= 0 || !finiteInteger(row.tmdbEpisodeId) || row.tmdbEpisodeId <= 0 ||
        !text(row.name, 1000) || (row.runtime !== null && (!finiteInteger(row.runtime) || row.runtime < 0)) ||
        !nullableIso(row.airDate) || !text(row.overview, 20000)) {
      throw new InvalidMigrationPayloadError('Invalid episode row');
    }
  }
  for (const service of typed.services) {
    if (!text(service.serviceKey, 80) || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(service.serviceKey) ||
        !text(service.displayName, 80) || !text(service.logoGlyph, 40) || typeof service.userSelected !== 'boolean' ||
        !['streaming-availability', 'tmdb-fallback', 'unsupported'].includes(String(service.availabilitySource))) {
      throw new InvalidMigrationPayloadError('Invalid streaming service row');
    }
  }
  for (const row of typed.library) {
    if (!canonicalTitleId(row.titleId) || !iso(row.addedAt) || !LIBRARY_STATUSES.includes(row.derivedStatus) || !iso(row.statusComputedAt)) {
      throw new InvalidMigrationPayloadError('Invalid Library row');
    }
  }
  for (const row of typed.ratings) {
    if (!canonicalTitleId(row.titleId) || !finiteInteger(row.stars) || row.stars < 1 || row.stars > 5 || !iso(row.ratedAt)) {
      throw new InvalidMigrationPayloadError('Invalid rating row');
    }
  }
  for (const row of typed.watchedService) {
    if (!canonicalTitleId(row.titleId) || !text(row.serviceKey, 80) || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(row.serviceKey) || !iso(row.changedAt)) {
      throw new InvalidMigrationPayloadError('Invalid watched service row');
    }
  }
  for (const row of typed.watchOverrides) {
    if (!text(row.id, 200) || !['movie', 'episode', 'season'].includes(String(row.scopeType)) || !canonicalTitleId(row.titleId) ||
        !['watched', 'unwatched'].includes(String(row.state)) || !iso(row.changedAt) ||
        (row.seasonNumber !== undefined && (!finiteInteger(row.seasonNumber) || row.seasonNumber < 0)) ||
        (row.episodeNumber !== undefined && (!finiteInteger(row.episodeNumber) || row.episodeNumber <= 0))) {
      throw new InvalidMigrationPayloadError('Invalid watch override row');
    }
  }
  for (const row of typed.watchEvents) {
    if (!text(row.id, 200) || !text(row.providerEventId, 200) || !canonicalTitleId(row.titleId) || row.source !== 'trakt' || !iso(row.watchedAt) ||
        (row.seasonNumber !== undefined && (!finiteInteger(row.seasonNumber) || row.seasonNumber < 0)) ||
        (row.episodeNumber !== undefined && (!finiteInteger(row.episodeNumber) || row.episodeNumber <= 0))) {
      throw new InvalidMigrationPayloadError('Invalid watch event row');
    }
  }
  for (const row of typed.availability) {
    if (!canonicalTitleId(row.titleId) || !text(row.serviceKey, 80) || !['subscription', 'rent', 'buy'].includes(row.optionType) ||
        !optionalText(row.deepLink, 4000) || !nullableIso(row.startsAt) || !nullableIso(row.endsAt) || !iso(row.checkedAt) ||
        !['streaming-availability', 'tmdb-fallback'].includes(row.source)) {
      throw new InvalidMigrationPayloadError('Invalid availability row');
    }
  }
  for (const row of typed.alerts) {
    if (!text(row.id, 200) || !canonicalTitleId(row.titleId) || !ALERT_TYPES.includes(row.alertType) || !text(row.message, 4000) ||
        !nullableIso(row.eventDate) || !iso(row.createdAt) || !nullableIso(row.seenAt) || !text(row.dedupeKey, 1000)) {
      throw new InvalidMigrationPayloadError('Invalid alert row');
    }
  }
  for (const row of typed.syncState) {
    if (!['trakt', 'metadata', 'availability'].includes(row.syncType) || !nullableIso(row.lastAttemptAt) || !nullableIso(row.lastSuccessAt)) {
      throw new InvalidMigrationPayloadError('Invalid sync state row');
    }
  }
}

async function firstCount(db: D1Database, sql: string): Promise<number> {
  const row = await db.prepare(sql).first<{ count: number }>();
  return Number(row?.count ?? 0);
}

async function assertPristineBackend(db: D1Database): Promise<void> {
  const tables = [
    'titles', 'title_metadata', 'seasons', 'episodes', 'watch_events', 'watch_overrides', 'library_items',
    'ratings', 'watched_service', 'availability', 'alerts', 'sync_state', 'provider_connections', 'recommendation_cache'
  ];
  for (const table of tables) {
    if (await firstCount(db, `SELECT COUNT(*) AS count FROM ${table}`) !== 0) {
      throw new MigrationConflictError(`Backend is not pristine: ${table} already contains rows`);
    }
  }
  const builtIns = BUILT_IN_SERVICES.map((key) => `'${key}'`).join(', ');
  if (await firstCount(db, `SELECT COUNT(*) AS count FROM services WHERE service_key NOT IN (${builtIns})`) !== 0) {
    throw new MigrationConflictError('Backend already contains custom streaming services');
  }
}

function statement(db: D1Database, sql: string, values: D1Primitive[]): D1PreparedStatement {
  return db.prepare(sql).bind(...values);
}

export async function importLocalState(db: D1Database, bundle: BackendMigrationBundle): Promise<{ alreadyApplied: boolean }> {
  if (!object(bundle) || !text(bundle.migrationId, 80) || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(bundle.migrationId)) {
    throw new InvalidMigrationPayloadError('Invalid migration id');
  }
  assertSnapshot(bundle.snapshot);

  const existing = await db.prepare('SELECT value FROM app_meta WHERE key = ?').bind(MIGRATION_META_KEY).first<{ value: string }>();
  if (existing?.value) {
    if (existing.value === bundle.migrationId) return { alreadyApplied: true };
    throw new MigrationConflictError('Backend has already been activated by another local-state migration');
  }

  await assertPristineBackend(db);
  const s = bundle.snapshot;
  const statements: D1PreparedStatement[] = [];

  for (const service of s.services) {
    statements.push(statement(db, `INSERT INTO services
      (service_key, display_name, logo_ref, user_selected, availability_source, subscription_catalog_key)
      VALUES (?, ?, ?, ?, ?, NULL)
      ON CONFLICT(service_key) DO UPDATE SET display_name=excluded.display_name, logo_ref=excluded.logo_ref,
        user_selected=excluded.user_selected, availability_source=excluded.availability_source`,
    [service.serviceKey, service.displayName, service.logoGlyph, service.userSelected ? 1 : 0, service.availabilitySource]));
  }
  for (const title of s.titles) {
    statements.push(statement(db, `INSERT INTO titles (id, media_type, tmdb_id, trakt_id, imdb_id, availability_id, title, year)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET media_type=excluded.media_type, tmdb_id=excluded.tmdb_id,
        trakt_id=excluded.trakt_id, imdb_id=excluded.imdb_id, availability_id=excluded.availability_id,
        title=excluded.title, year=excluded.year`,
    [title.id, title.mediaType, title.tmdbId, title.traktId ?? null, title.imdbId ?? null, title.availabilityId ?? null, title.title, title.year]));
  }
  for (const row of s.metadata) {
    statements.push(statement(db, `INSERT INTO title_metadata
      (title_id, status, overview, genres_json, poster_path, backdrop_path, trailer_key, release_date, metadata_updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(title_id) DO UPDATE SET status=excluded.status, overview=excluded.overview, genres_json=excluded.genres_json,
        poster_path=excluded.poster_path, backdrop_path=excluded.backdrop_path, trailer_key=excluded.trailer_key,
        release_date=excluded.release_date, metadata_updated_at=excluded.metadata_updated_at`,
    [row.titleId, row.status, row.overview, JSON.stringify(row.genres), row.posterPath, row.backdropPath,
      row.trailerKey, row.releaseDate ?? null, row.metadataUpdatedAt]));
  }
  for (const row of s.seasons) {
    statements.push(statement(db, `INSERT INTO seasons (title_id, season_number, tmdb_season_id, name, episode_count, air_date)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(title_id, season_number) DO UPDATE SET tmdb_season_id=excluded.tmdb_season_id, name=excluded.name,
        episode_count=excluded.episode_count, air_date=excluded.air_date`,
    [row.titleId, row.seasonNumber, row.tmdbSeasonId, row.name, row.episodeCount, row.airDate]));
  }
  for (const row of s.episodes) {
    statements.push(statement(db, `INSERT INTO episodes
      (title_id, season_number, episode_number, tmdb_episode_id, name, runtime, air_date, overview)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(title_id, season_number, episode_number) DO UPDATE SET tmdb_episode_id=excluded.tmdb_episode_id,
        name=excluded.name, runtime=excluded.runtime, air_date=excluded.air_date, overview=excluded.overview`,
    [row.titleId, row.seasonNumber, row.episodeNumber, row.tmdbEpisodeId, row.name, row.runtime, row.airDate, row.overview]));
  }
  for (const row of s.watchEvents) {
    statements.push(statement(db, `INSERT INTO watch_events
      (provider_event_id, id, title_id, season_number, episode_number, watched_at, source)
      VALUES (?, ?, ?, ?, ?, ?, 'trakt')
      ON CONFLICT(provider_event_id) DO UPDATE SET id=excluded.id, title_id=excluded.title_id,
        season_number=excluded.season_number, episode_number=excluded.episode_number, watched_at=excluded.watched_at`,
    [row.providerEventId, row.id, row.titleId, row.seasonNumber ?? null, row.episodeNumber ?? null, row.watchedAt]));
  }
  for (const row of s.watchOverrides) {
    statements.push(statement(db, `INSERT INTO watch_overrides
      (id, scope_type, title_id, season_number, episode_number, state, changed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT DO UPDATE SET state=excluded.state, changed_at=excluded.changed_at`,
    [row.id, row.scopeType, row.titleId, row.seasonNumber ?? null, row.episodeNumber ?? null, row.state, row.changedAt]));
  }
  for (const row of s.library) {
    statements.push(statement(db, `INSERT INTO library_items (title_id, added_at, derived_status, status_computed_at)
      VALUES (?, ?, ?, ?) ON CONFLICT(title_id) DO UPDATE SET added_at=excluded.added_at,
        derived_status=excluded.derived_status, status_computed_at=excluded.status_computed_at`,
    [row.titleId, row.addedAt, row.derivedStatus, row.statusComputedAt]));
  }
  for (const row of s.ratings) {
    statements.push(statement(db, `INSERT INTO ratings (title_id, stars, rated_at) VALUES (?, ?, ?)
      ON CONFLICT(title_id) DO UPDATE SET stars=excluded.stars, rated_at=excluded.rated_at`,
    [row.titleId, row.stars, row.ratedAt]));
  }
  for (const row of s.watchedService) {
    statements.push(statement(db, `INSERT INTO watched_service (title_id, service_key, changed_at) VALUES (?, ?, ?)
      ON CONFLICT(title_id) DO UPDATE SET service_key=excluded.service_key, changed_at=excluded.changed_at`,
    [row.titleId, row.serviceKey, row.changedAt]));
  }
  for (const row of s.availability) {
    statements.push(statement(db, `INSERT INTO availability
      (title_id, service_key, option_type, deep_link, starts_at, ends_at, checked_at, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(title_id, service_key, option_type) DO UPDATE SET deep_link=excluded.deep_link,
        starts_at=excluded.starts_at, ends_at=excluded.ends_at, checked_at=excluded.checked_at, source=excluded.source`,
    [row.titleId, row.serviceKey, row.optionType, row.deepLink, row.startsAt, row.endsAt, row.checkedAt, row.source]));
  }
  for (const row of s.alerts) {
    statements.push(statement(db, `INSERT INTO alerts
      (id, title_id, alert_type, message, event_date, created_at, seen_at, dedupe_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT DO UPDATE SET title_id=excluded.title_id, alert_type=excluded.alert_type, message=excluded.message,
        event_date=excluded.event_date, created_at=excluded.created_at, seen_at=excluded.seen_at, dedupe_key=excluded.dedupe_key`,
    [row.id, row.titleId, row.alertType, row.message, row.eventDate, row.createdAt, row.seenAt, row.dedupeKey]));
  }
  // Provider sync cursors/timestamps are intentionally not migrated. They are provider-owned state
  // and must be recreated by the real backend integrations rather than promoted from a local or
  // synthetic browser cache during user-state takeover.
  statements.push(statement(db, 'INSERT INTO app_meta (key, value) VALUES (?, ?)', [MIGRATION_META_KEY, bundle.migrationId]));

  const results = await db.batch(statements);
  if (results.length !== statements.length || results.some((result) => !result.success)) {
    throw new Error('D1 local-state migration transaction failed');
  }
  return { alreadyApplied: false };
}
