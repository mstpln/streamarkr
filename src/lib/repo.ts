// Repository layer: the only place UI code talks to the browser cache. D1 is the target durable
// source of truth; IndexedDB remains the cached/offline read layer. User-owned mutations remain
// explicit here so later Worker-backed writes can preserve ownership boundaries consistently.
import * as db from './db.js';
import * as F from './fixtures.js';
import { TmdbAdapter, TraktAdapter, AvailabilityAdapter } from './providers.js';
import { computeSeriesStatus, computeNewSeasonEntry, isFullyWatchedForRating } from './status.js';
import { buildHistoryRow, sortRecentlyWatched, type HistoryRow } from './history.js';
import { generateAlerts, applyRetention, buildReleaseSnapshot, type ReleaseSnapshot } from './alerts.js';
import { resolveMovie } from './resolve.js';
import { exportTitleIdentity, type ExportTitleIdentity } from './export.js';
import type { BackendSnapshot } from './backend-contract.js';
import type {
  AlertRecord,
  AvailabilityEntry,
  Episode,
  LibraryItem,
  Rating,
  Season,
  ServiceDef,
  Title,
  TitleMetadata,
  WatchEvent,
  WatchOverride,
  WatchedService
} from './types.js';

const SEED_FLAG = 'seeded_v1';
const DATA_SOURCE_KEY = 'data_source';
const BACKEND_SNAPSHOT_AT_KEY = 'backend_snapshot_generated_at';

async function currentDataSource(): Promise<string | undefined> {
  return (await db.get<{ key: string; value: string }>('meta', DATA_SOURCE_KEY))?.value;
}

async function assertLocalMutationAllowed(): Promise<void> {
  if ((await currentDataSource()) === 'backend') {
    throw new Error('Local-only mutation is disabled while a Worker/D1 snapshot cache is active. Use a Worker-backed mutation.');
  }
}

export async function ensureSeeded(): Promise<void> {
  const source = await currentDataSource();
  // A previously hydrated Worker snapshot is a valid offline cache. Never overwrite it with demo
  // fixtures just because the app starts while the Worker is unavailable.
  if (source === 'backend') return;

  const [flag, availabilityInvalidated] = await Promise.all([
    db.get<{ key: string; value: boolean }>('meta', SEED_FLAG),
    db.get<{ key: string; value: boolean }>('meta', db.AVAILABILITY_CACHE_INVALIDATED_KEY)
  ]);
  if (flag?.value) {
    // v1 -> v2 deliberately drops only provider-owned availability to change its key. Existing
    // synthetic installs have seeded_v1=true, so refill exactly that cache once and preserve every
    // user-owned store rather than re-running the full fixture seed.
    if (availabilityInvalidated?.value) {
      await db.putAll('availability', F.AVAILABILITY);
      await db.del('meta', db.AVAILABILITY_CACHE_INVALIDATED_KEY);
    }
    // v0.13 and older IndexedDB caches predate this provenance marker. Tag them as fixtures during
    // the normal upgrade/startup path so future backend activation can never mistake legacy data
    // for a genuinely empty cache.
    if (!source) await db.put('meta', { key: DATA_SOURCE_KEY, value: 'fixtures' });
    return;
  }

  await db.putAll('titles', F.TITLES);
  await db.putAll('title_metadata', F.TITLE_METADATA);
  await db.putAll('seasons', F.SEASONS);
  await db.putAll('episodes', F.EPISODES);
  await db.putAll('watch_events', F.WATCH_EVENTS);
  await db.putAll('watch_overrides', F.WATCH_OVERRIDES);
  await db.putAll('library_items', F.LIBRARY_ITEMS);
  await db.putAll('ratings', F.RATINGS);
  await db.putAll('watched_service', F.WATCHED_SERVICE);
  await db.putAll('services', F.SERVICES);
  await db.putAll('availability', F.AVAILABILITY);
  await db.putAll('alerts', F.ALERTS);
  await db.put('meta', { key: DATA_SOURCE_KEY, value: 'fixtures' });
  await db.put('meta', { key: SEED_FLAG, value: true });
}

/** Atomically replace the complete browser cache from one authenticated Worker snapshot.
 * This is intentionally a cache hydration boundary, not a provider refresh. The snapshot already
 * contains both provider-owned and durable user-owned D1 state, so replacing these stores together
 * prevents mixed old/new views. Initial takeover of a non-empty fixture/local cache is blocked:
 * future activation must first migrate or deliberately reset local user-owned state. */
export async function applyBackendSnapshot(snapshot: BackendSnapshot): Promise<void> {
  if (snapshot.schemaVersion !== 1) {
    throw new Error(`Unsupported Streamarkr backend schema version: ${snapshot.schemaVersion}`);
  }
  if (!snapshot.generatedAt || Number.isNaN(Date.parse(snapshot.generatedAt))) {
    throw new Error('Invalid Streamarkr backend snapshot timestamp');
  }

  const source = await currentDataSource();
  // Older installed caches may not have DATA_SOURCE_KEY at all. Never treat a missing provenance
  // marker as proof that the cache is empty; inspect the actual data stores before first takeover.
  if (source !== 'backend' && (source !== undefined || await db.hasAnyData())) {
    throw new Error('Initial Worker/D1 cache activation is blocked until local user data has been migrated or explicitly reset.');
  }

  await db.replaceStores([
    { store: 'titles', values: snapshot.titles },
    { store: 'title_metadata', values: snapshot.metadata },
    { store: 'seasons', values: snapshot.seasons },
    { store: 'episodes', values: snapshot.episodes },
    { store: 'watch_events', values: snapshot.watchEvents },
    { store: 'watch_overrides', values: snapshot.watchOverrides },
    { store: 'library_items', values: snapshot.library },
    { store: 'ratings', values: snapshot.ratings },
    { store: 'watched_service', values: snapshot.watchedService },
    { store: 'services', values: snapshot.services },
    { store: 'availability', values: snapshot.availability },
    { store: 'alerts', values: snapshot.alerts },
    { store: 'sync_state', values: snapshot.syncState },
    { store: 'meta', values: [
      { key: DATA_SOURCE_KEY, value: 'backend' },
      { key: BACKEND_SNAPSHOT_AT_KEY, value: snapshot.generatedAt }
    ] }
  ]);
}

export async function backendCacheInfo(): Promise<{ active: boolean; generatedAt: string | null }> {
  const [source, generatedAt] = await Promise.all([
    currentDataSource(),
    db.get<{ key: string; value: string }>('meta', BACKEND_SNAPSHOT_AT_KEY)
  ]);
  return { active: source === 'backend', generatedAt: generatedAt?.value ?? null };
}

export async function resetToFixtures(): Promise<void> {
  await db.clearAll();
  await db.put('meta', { key: DATA_SOURCE_KEY, value: 'fixtures' });
  await db.put('meta', { key: SEED_FLAG, value: false });
  await ensureSeeded();
}

// --- Reads -------------------------------------------------------------------------------

export const allTitles = () => db.getAll<Title>('titles');
export const allMetadata = () => db.getAll<TitleMetadata>('title_metadata');
export const allSeasons = () => db.getAll<Season>('seasons');
export const allEpisodes = () => db.getAll<Episode>('episodes');
export const allEvents = () => db.getAll<WatchEvent>('watch_events');
export const allOverrides = () => db.getAll<WatchOverride>('watch_overrides');
export const allLibrary = () => db.getAll<LibraryItem>('library_items');
export const allRatings = () => db.getAll<Rating>('ratings');
export const allWatchedService = () => db.getAll<WatchedService>('watched_service');
export const allServices = () => db.getAll<ServiceDef>('services');
export const allAvailability = () => db.getAll<AvailabilityEntry>('availability');
export const allAlerts = () => db.getAll<AlertRecord>('alerts');

export async function getTitle(id: string): Promise<Title | undefined> {
  return db.get<Title>('titles', id);
}
export async function getMetadata(id: string): Promise<TitleMetadata | undefined> {
  return db.get<TitleMetadata>('title_metadata', id);
}

export interface TitleBundle {
  title: Title;
  metadata?: TitleMetadata;
  seasons: Season[];
  episodes: Episode[];
  events: WatchEvent[];
  overrides: WatchOverride[];
  library?: LibraryItem;
  rating?: Rating;
  watchedService?: WatchedService;
  availability: AvailabilityEntry[];
  status: string;
}

export async function getTitleBundle(id: string): Promise<TitleBundle | undefined> {
  const title = await getTitle(id);
  if (!title) return undefined;
  const [metadata, seasons, episodes, events, overrides, library, ratings, watchedServices, availability] = await Promise.all([
    getMetadata(id),
    allSeasons(),
    allEpisodes(),
    allEvents(),
    allOverrides(),
    db.get<LibraryItem>('library_items', id),
    allRatings(),
    allWatchedService(),
    allAvailability()
  ]);
  const mySeasons = seasons.filter((s) => s.titleId === id);
  const myEpisodes = episodes.filter((e) => e.titleId === id);
  const status =
    title.mediaType === 'series'
      ? computeSeriesStatus({ titleId: id, episodes: myEpisodes, metadataStatus: metadata?.status ?? 'Returning Series', events, overrides })
      : resolveMovie(id, events, overrides).watched
        ? 'Finished'
        : 'To Watch';
  return {
    title,
    metadata,
    seasons: mySeasons,
    episodes: myEpisodes,
    events,
    overrides,
    library,
    rating: ratings.find((r) => r.titleId === id),
    watchedService: watchedServices.find((w) => w.titleId === id),
    availability: availability.filter((a) => a.titleId === id),
    status
  };
}

// --- Library mutations (user-owned) -------------------------------------------------------
// Future real-search flow: persist canonical title/crosswalk + metadata/season/availability data
// before adding membership. This precondition prevents dangling Library rows.
export async function addToLibrary(titleId: string): Promise<void> {
  await assertLocalMutationAllowed();
  const existing = await db.get<LibraryItem>('library_items', titleId);
  if (existing) return;
  const title = await getTitle(titleId);
  if (!title) {
    throw new Error(
      `Cannot add "${titleId}" to My Library: no title record exists yet. Persist the title (and its ` +
      `metadata/seasons/availability) before adding library membership.`
    );
  }
  await db.put('library_items', { titleId, addedAt: new Date().toISOString(), derivedStatus: 'To Watch', statusComputedAt: new Date().toISOString() } satisfies LibraryItem);
}

export async function removeFromLibrary(titleId: string): Promise<void> {
  await assertLocalMutationAllowed();
  // Only removes tracking membership. History, ratings, watched_service and overrides are untouched.
  await db.del('library_items', titleId);
}

export async function isInLibrary(titleId: string): Promise<boolean> {
  return !!(await db.get('library_items', titleId));
}

export async function setRating(titleId: string, stars: 1 | 2 | 3 | 4 | 5): Promise<void> {
  await assertLocalMutationAllowed();
  await db.put('ratings', { titleId, stars, ratedAt: new Date().toISOString() } satisfies Rating);
}

export async function clearRating(titleId: string): Promise<void> {
  await assertLocalMutationAllowed();
  await db.del('ratings', titleId);
}

export async function setWatchedService(titleId: string, serviceKey: string | null): Promise<void> {
  await assertLocalMutationAllowed();
  if (serviceKey === null) {
    await db.del('watched_service', titleId);
    return;
  }
  await db.put('watched_service', { titleId, serviceKey, changedAt: new Date().toISOString() } satisfies WatchedService);
}

let overrideSeq = 1;
export async function setEpisodeOverride(titleId: string, seasonNumber: number, episodeNumber: number, state: 'watched' | 'unwatched'): Promise<void> {
  await assertLocalMutationAllowed();
  const all = await db.getAll<WatchOverride>('watch_overrides');
  const existing = all.find((o) => o.scopeType === 'episode' && o.titleId === titleId && o.seasonNumber === seasonNumber && o.episodeNumber === episodeNumber);
  const rec: WatchOverride = { id: existing?.id ?? `ov-ui-${Date.now()}-${overrideSeq++}`, scopeType: 'episode', titleId, seasonNumber, episodeNumber, state, changedAt: new Date().toISOString() };
  await db.put('watch_overrides', rec);
}

/** Apply a season bulk action only to episodes that are already released and known at the
 * moment of the action. Future episodes must not inherit an old bulk decision. */
export async function setSeasonOverride(titleId: string, seasonNumber: number, state: 'watched' | 'unwatched'): Promise<void> {
  await assertLocalMutationAllowed();
  const now = new Date();
  const [episodes, overrides] = await Promise.all([allEpisodes(), allOverrides()]);
  for (const override of overrides) {
    if (override.scopeType === 'season' && override.titleId === titleId && override.seasonNumber === seasonNumber) {
      await db.del('watch_overrides', override.id);
    }
  }
  const releasedKnown = episodes.filter((episode) =>
    episode.titleId === titleId &&
    episode.seasonNumber === seasonNumber &&
    !!episode.airDate &&
    new Date(episode.airDate) <= now
  );
  for (const episode of releasedKnown) {
    await setEpisodeOverride(titleId, seasonNumber, episode.episodeNumber, state);
  }
}

export async function setMovieOverride(titleId: string, state: 'watched' | 'unwatched'): Promise<void> {
  await assertLocalMutationAllowed();
  const all = await db.getAll<WatchOverride>('watch_overrides');
  const existing = all.find((o) => o.scopeType === 'movie' && o.titleId === titleId);
  const rec: WatchOverride = { id: existing?.id ?? `ov-ui-${Date.now()}-${overrideSeq++}`, scopeType: 'movie', titleId, state, changedAt: new Date().toISOString() };
  await db.put('watch_overrides', rec);
}

export async function setServiceSelected(serviceKey: string, selected: boolean): Promise<void> {
  await assertLocalMutationAllowed();
  const svc = await db.get<ServiceDef>('services', serviceKey);
  if (!svc) return;
  await db.put('services', { ...svc, userSelected: selected });
}

function normalizeCustomServiceKey(displayName: string): string {
  return displayName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export async function addCustomService(displayName: string): Promise<void> {
  await assertLocalMutationAllowed();
  const trimmed = displayName.trim();
  if (!trimmed || trimmed.length > 80 || !/[a-z0-9]/i.test(trimmed)) return;
  const key = normalizeCustomServiceKey(trimmed);
  if (!key || key.length > 80) return;
  const existing = await db.get<ServiceDef>('services', key);
  if (existing) {
    if (existing.displayName.trim().toLocaleLowerCase() !== trimmed.toLocaleLowerCase()) {
      throw new Error(`A different streaming service already uses the normalized key: ${key}`);
    }
    if (!existing.userSelected) await db.put('services', { ...existing, userSelected: true });
    return;
  }
  await db.put('services', { serviceKey: key, displayName: trimmed, logoGlyph: trimmed[0]?.toUpperCase() ?? '?', userSelected: true, availabilitySource: 'unsupported' } satisfies ServiceDef);
}

// --- Alerts ---------------------------------------------------------------------------------
export async function markAlertsSeen(ids: string[]): Promise<void> {
  await assertLocalMutationAllowed();
  const now = new Date().toISOString();
  for (const id of ids) {
    const a = await db.get<AlertRecord>('alerts', id);
    if (a && !a.seenAt) await db.put('alerts', { ...a, seenAt: now });
  }
}

// --- Sync now (fake) -------------------------------------------------------------------------
const PREV_AVAILABILITY_KEY = 'prev_availability_snapshot';
const PREV_RELEASE_KEY = 'prev_release_snapshot';
const PREV_CHECK_AT_KEY = 'prev_alert_check_at';

/** Availability is provider-owned, so a fresh provider snapshot fully replaces the previous one.
 * This never touches user-owned stores. The cache key includes optionType to match D1 semantics. */
export async function reconcileAvailability(current: AvailabilityEntry[]): Promise<void> {
  const existing = await allAvailability();
  const key = (row: AvailabilityEntry) => `${row.titleId}\u0000${row.serviceKey}\u0000${row.optionType}`;
  const currentKeys = new Set(current.map(key));
  await db.putAll('availability', current);
  for (const row of existing) {
    if (!currentKeys.has(key(row))) {
      await db.del('availability', [row.titleId, row.serviceKey, row.optionType]);
    }
  }
}

export async function syncNow(): Promise<{ historyEvents: number; alertsCreated: number }> {
  if ((await backendCacheInfo()).active) {
    throw new Error('Synthetic provider sync is disabled while a Worker/D1 snapshot cache is active.');
  }

  const now = new Date();
  await db.put('sync_state', { syncType: 'trakt', lastAttemptAt: now.toISOString(), lastSuccessAt: now.toISOString() });
  const events = await TraktAdapter.getHistory();
  await db.putAll('watch_events', events);
  const currentAvailability = await AvailabilityAdapter.getAllAvailability();
  await reconcileAvailability(currentAvailability);

  const [titles, metadata, libraryItems, seasons, episodes, overrides, services, existingAlerts] = await Promise.all([
    allTitles(), allMetadata(), allLibrary(), allSeasons(), allEpisodes(), allOverrides(), allServices(), allAlerts()
  ]);

  const currentRelease = buildReleaseSnapshot(titles, metadata, seasons, episodes, now);
  const prevAvailMeta = await db.get<{ key: string; value: AvailabilityEntry[] }>('meta', PREV_AVAILABILITY_KEY);
  const prevReleaseMeta = await db.get<{ key: string; value: ReleaseSnapshot }>('meta', PREV_RELEASE_KEY);
  const prevCheckMeta = await db.get<{ key: string; value: string }>('meta', PREV_CHECK_AT_KEY);

  const previousAvailability = prevAvailMeta?.value ?? currentAvailability;
  const previousRelease = prevReleaseMeta?.value ?? currentRelease;
  const previousCheckAt = prevCheckMeta?.value ? new Date(prevCheckMeta.value) : now;

  const fresh = generateAlerts({
    now, titles, metadata, libraryItems, seasons, episodes, events, overrides, services, existingAlerts,
    previousAvailability, currentAvailability, previousRelease, currentRelease, previousCheckAt
  });
  if (fresh.length > 0) {
    const merged = applyRetention([...fresh, ...existingAlerts]);
    for (const a of merged) await db.put('alerts', a);
    const keep = new Set(merged.map((a) => a.id));
    for (const a of existingAlerts) if (!keep.has(a.id)) await db.del('alerts', a.id);
  }

  await db.put('meta', { key: PREV_AVAILABILITY_KEY, value: currentAvailability });
  await db.put('meta', { key: PREV_RELEASE_KEY, value: currentRelease });
  await db.put('meta', { key: PREV_CHECK_AT_KEY, value: now.toISOString() });

  return { historyEvents: events.length, alertsCreated: fresh.length };
}

// --- Data export -----------------------------------------------------------------------------
// Provider-cache metadata/availability are re-fetchable and excluded, but stable external
// identity crosswalks are preserved so exported user-owned state can be reconnected safely.
export interface ExportPayload {
  exportedAt: string;
  titles: ExportTitleIdentity[];
  library: LibraryItem[];
  ratings: Rating[];
  overrides: WatchOverride[];
  watchedService: WatchedService[];
  watchEvents: WatchEvent[];
  preferences: { selectedServices: string[] };
  alerts: { id: string; titleId: string; alertType: string; message: string; eventDate: string | null; seenAt: string | null; createdAt: string }[];
}

export async function buildExportPayload(): Promise<ExportPayload> {
  const [titles, library, ratings, overrides, watchedService, events, services, alerts] = await Promise.all([
    allTitles(), allLibrary(), allRatings(), allOverrides(), allWatchedService(), allEvents(), allServices(), allAlerts()
  ]);
  return {
    exportedAt: new Date().toISOString(),
    titles: titles.map(exportTitleIdentity),
    library,
    ratings,
    overrides,
    watchedService,
    watchEvents: events,
    preferences: { selectedServices: services.filter((s) => s.userSelected).map((s) => s.serviceKey) },
    alerts: alerts.map((a) => ({ id: a.id, titleId: a.titleId, alertType: a.alertType, message: a.message, eventDate: a.eventDate, seenAt: a.seenAt, createdAt: a.createdAt }))
  };
}

export { TmdbAdapter, AvailabilityAdapter, computeNewSeasonEntry, isFullyWatchedForRating, buildHistoryRow, sortRecentlyWatched };
