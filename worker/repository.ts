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
} from '../src/lib/types.js';
import type { BackendSnapshot } from '../src/lib/backend-contract.js';
import type { D1Database, D1Primitive } from './types.js';

type Row = Record<string, unknown>;

export class MissingCanonicalTitleError extends Error {
  constructor(titleId: string) {
    super(`Cannot add ${titleId} to My Library before its canonical title record exists`);
    this.name = 'MissingCanonicalTitleError';
  }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
function nullableText(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
function integer(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0);
}
function optionalInteger(value: unknown): number | undefined {
  return value === null || value === undefined ? undefined : integer(value);
}
function bool(value: unknown): boolean {
  return integer(value) === 1;
}
function parseGenres(value: unknown): string[] {
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

async function allRows<T extends Row>(db: D1Database, sql: string): Promise<T[]> {
  const result = await db.prepare(sql).all<T>();
  if (!result.success) throw new Error('D1 query failed');
  return result.results ?? [];
}

export async function schemaVersion(db: D1Database): Promise<number> {
  const row = await db.prepare("SELECT value FROM app_meta WHERE key = 'schema_version'").first<{ value: string }>();
  if (!row?.value) return 0;
  const value = Number(row.value);
  return Number.isFinite(value) ? value : 0;
}

export async function loadSnapshot(db: D1Database, now = new Date()): Promise<BackendSnapshot> {
  const [titlesRows, metadataRows, seasonRows, episodeRows, eventRows, overrideRows, libraryRows, ratingRows,
    watchedServiceRows, serviceRows, availabilityRows, alertRows, syncRows, version] = await Promise.all([
    allRows<Row>(db, 'SELECT * FROM titles ORDER BY title COLLATE NOCASE, year'),
    allRows<Row>(db, 'SELECT * FROM title_metadata'),
    allRows<Row>(db, 'SELECT * FROM seasons ORDER BY title_id, season_number'),
    allRows<Row>(db, 'SELECT * FROM episodes ORDER BY title_id, season_number, episode_number'),
    allRows<Row>(db, 'SELECT * FROM watch_events ORDER BY watched_at DESC'),
    allRows<Row>(db, 'SELECT * FROM watch_overrides ORDER BY changed_at DESC'),
    allRows<Row>(db, 'SELECT * FROM library_items ORDER BY added_at DESC'),
    allRows<Row>(db, 'SELECT * FROM ratings ORDER BY rated_at DESC'),
    allRows<Row>(db, 'SELECT * FROM watched_service'),
    allRows<Row>(db, 'SELECT * FROM services ORDER BY display_name COLLATE NOCASE'),
    allRows<Row>(db, 'SELECT * FROM availability ORDER BY title_id, service_key, option_type'),
    allRows<Row>(db, 'SELECT * FROM alerts ORDER BY created_at DESC LIMIT 30'),
    allRows<Row>(db, 'SELECT * FROM sync_state'),
    schemaVersion(db)
  ]);

  const titles: Title[] = titlesRows.map((row) => ({
    id: text(row.id), mediaType: text(row.media_type) as Title['mediaType'], tmdbId: integer(row.tmdb_id),
    ...(row.trakt_id == null ? {} : { traktId: integer(row.trakt_id) }),
    ...(row.imdb_id == null ? {} : { imdbId: text(row.imdb_id) }),
    ...(row.availability_id == null ? {} : { availabilityId: text(row.availability_id) }),
    title: text(row.title), year: integer(row.year)
  }));
  const metadata: TitleMetadata[] = metadataRows.map((row) => ({
    titleId: text(row.title_id), status: text(row.status) as TitleMetadata['status'], overview: text(row.overview),
    genres: parseGenres(row.genres_json), posterPath: text(row.poster_path), backdropPath: text(row.backdrop_path),
    trailerKey: nullableText(row.trailer_key), metadataUpdatedAt: text(row.metadata_updated_at), releaseDate: nullableText(row.release_date)
  }));
  const seasons: Season[] = seasonRows.map((row) => ({
    titleId: text(row.title_id), seasonNumber: integer(row.season_number), tmdbSeasonId: integer(row.tmdb_season_id),
    name: text(row.name), episodeCount: integer(row.episode_count), airDate: nullableText(row.air_date)
  }));
  const episodes: Episode[] = episodeRows.map((row) => ({
    titleId: text(row.title_id), seasonNumber: integer(row.season_number), episodeNumber: integer(row.episode_number),
    tmdbEpisodeId: integer(row.tmdb_episode_id), name: text(row.name), runtime: row.runtime == null ? null : integer(row.runtime),
    airDate: nullableText(row.air_date), overview: text(row.overview)
  }));
  const watchEvents: WatchEvent[] = eventRows.map((row) => ({
    id: text(row.id), providerEventId: text(row.provider_event_id), titleId: text(row.title_id),
    ...(optionalInteger(row.season_number) === undefined ? {} : { seasonNumber: optionalInteger(row.season_number) }),
    ...(optionalInteger(row.episode_number) === undefined ? {} : { episodeNumber: optionalInteger(row.episode_number) }),
    watchedAt: text(row.watched_at), source: 'trakt'
  }));
  const watchOverrides: WatchOverride[] = overrideRows.map((row) => ({
    id: text(row.id), scopeType: text(row.scope_type) as WatchOverride['scopeType'], titleId: text(row.title_id),
    ...(optionalInteger(row.season_number) === undefined ? {} : { seasonNumber: optionalInteger(row.season_number) }),
    ...(optionalInteger(row.episode_number) === undefined ? {} : { episodeNumber: optionalInteger(row.episode_number) }),
    state: text(row.state) as WatchOverride['state'], changedAt: text(row.changed_at)
  }));
  const library: LibraryItem[] = libraryRows.map((row) => ({
    titleId: text(row.title_id), addedAt: text(row.added_at), derivedStatus: text(row.derived_status) as LibraryItem['derivedStatus'],
    statusComputedAt: text(row.status_computed_at)
  }));
  const ratings: Rating[] = ratingRows.map((row) => ({
    titleId: text(row.title_id), stars: integer(row.stars) as Rating['stars'], ratedAt: text(row.rated_at)
  }));
  const watchedService: WatchedService[] = watchedServiceRows.map((row) => ({
    titleId: text(row.title_id), serviceKey: text(row.service_key), changedAt: text(row.changed_at)
  }));
  const services: ServiceDef[] = serviceRows.map((row) => ({
    serviceKey: text(row.service_key), displayName: text(row.display_name), logoGlyph: text(row.logo_ref),
    userSelected: bool(row.user_selected), availabilitySource: text(row.availability_source) as ServiceDef['availabilitySource']
  }));
  const availability: AvailabilityEntry[] = availabilityRows.map((row) => ({
    titleId: text(row.title_id), serviceKey: text(row.service_key), optionType: text(row.option_type) as AvailabilityEntry['optionType'],
    deepLink: nullableText(row.deep_link), startsAt: nullableText(row.starts_at), endsAt: nullableText(row.ends_at),
    checkedAt: text(row.checked_at), source: text(row.source) as AvailabilityEntry['source']
  }));
  const alerts: AlertRecord[] = alertRows.map((row) => ({
    id: text(row.id), titleId: text(row.title_id), alertType: text(row.alert_type) as AlertRecord['alertType'], message: text(row.message),
    eventDate: nullableText(row.event_date), createdAt: text(row.created_at), seenAt: nullableText(row.seen_at), dedupeKey: text(row.dedupe_key)
  }));
  const syncState: SyncState[] = syncRows.map((row) => ({
    syncType: text(row.sync_type) as SyncState['syncType'], lastAttemptAt: nullableText(row.last_attempt_at), lastSuccessAt: nullableText(row.last_success_at)
  }));

  return { schemaVersion: version, generatedAt: now.toISOString(), titles, metadata, seasons, episodes, watchEvents, watchOverrides,
    library, ratings, watchedService, services, availability, alerts, syncState };
}

async function run(db: D1Database, sql: string, values: D1Primitive[]): Promise<void> {
  const result = await db.prepare(sql).bind(...values).run();
  if (!result.success) throw new Error('D1 write failed');
}

export async function upsertTitle(db: D1Database, title: Title): Promise<void> {
  await run(db, `INSERT INTO titles (id, media_type, tmdb_id, trakt_id, imdb_id, availability_id, title, year)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET media_type=excluded.media_type, tmdb_id=excluded.tmdb_id,
      trakt_id=COALESCE(excluded.trakt_id, titles.trakt_id),
      imdb_id=COALESCE(excluded.imdb_id, titles.imdb_id),
      availability_id=COALESCE(excluded.availability_id, titles.availability_id),
      title=excluded.title, year=excluded.year`, [title.id, title.mediaType, title.tmdbId, title.traktId ?? null,
    title.imdbId ?? null, title.availabilityId ?? null, title.title, title.year]);
}

/** Replaces the complete, already-merged provider availability snapshot. The caller must include
 * every current provider source it wants to preserve. The D1 batch is transactional. */
export async function replaceAvailabilitySnapshot(db: D1Database, entries: AvailabilityEntry[]): Promise<void> {
  const statements = [db.prepare('DELETE FROM availability')];
  const insert = db.prepare(`INSERT INTO availability
    (title_id, service_key, option_type, deep_link, starts_at, ends_at, checked_at, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(title_id, service_key, option_type) DO UPDATE SET deep_link=excluded.deep_link,
      starts_at=excluded.starts_at, ends_at=excluded.ends_at, checked_at=excluded.checked_at, source=excluded.source`);
  for (const entry of entries) {
    statements.push(insert.bind(entry.titleId, entry.serviceKey, entry.optionType, entry.deepLink,
      entry.startsAt, entry.endsAt, entry.checkedAt, entry.source));
  }
  const results = await db.batch(statements);
  if (results.some((result) => !result.success)) throw new Error('D1 availability reconciliation failed');
}

export async function addLibraryItem(db: D1Database, titleId: string, now: string): Promise<void> {
  const title = await db.prepare('SELECT id FROM titles WHERE id = ?').bind(titleId).first<{ id: string }>();
  if (!title) throw new MissingCanonicalTitleError(titleId);
  await run(db, `INSERT INTO library_items (title_id, added_at, derived_status, status_computed_at)
    VALUES (?, ?, 'To Watch', ?) ON CONFLICT(title_id) DO NOTHING`, [titleId, now, now]);
}
export async function removeLibraryItem(db: D1Database, titleId: string): Promise<void> {
  await run(db, 'DELETE FROM library_items WHERE title_id = ?', [titleId]);
}
export async function setRating(db: D1Database, titleId: string, stars: Rating['stars'], now: string): Promise<void> {
  await run(db, `INSERT INTO ratings (title_id, stars, rated_at) VALUES (?, ?, ?)
    ON CONFLICT(title_id) DO UPDATE SET stars=excluded.stars, rated_at=excluded.rated_at`, [titleId, stars, now]);
}
export async function clearRating(db: D1Database, titleId: string): Promise<void> {
  await run(db, 'DELETE FROM ratings WHERE title_id = ?', [titleId]);
}
export async function markAlertsSeen(db: D1Database, ids: string[], now: string): Promise<void> {
  if (ids.length === 0) return;
  const statement = db.prepare('UPDATE alerts SET seen_at = COALESCE(seen_at, ?) WHERE id = ?');
  const results = await db.batch(ids.map((id) => statement.bind(now, id)));
  if (results.some((result) => !result.success)) throw new Error('D1 alert seen-state update failed');
}
