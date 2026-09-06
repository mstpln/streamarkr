// Read-model composition for the UI layer. Combines repo.ts CRUD data with the pure engines in
// status.ts / history.ts / discover.ts / alerts.ts.
import * as repo from './repo.js';
import { computeSeriesStatus, computeNewSeasonEntry, isFullyWatchedForRating } from './status.js';
import { buildHistoryRow, sortRecentlyWatched, type HistoryRow } from './history.js';
import { resolveMovie, lastRealWatchedAt } from './resolve.js';
import { computeRelevantSeason, seasonProgress } from './season-select.js';
import * as Discover from './discover.js';
import type { AvailabilityEntry, LibraryItem, MediaType, Rating, SeriesStatus, Title, TitleMetadata, WatchEvent, WatchOverride } from './types.js';

export interface Snapshot {
  titles: Title[];
  metadata: TitleMetadata[];
  seasons: import('./types').Season[];
  episodes: import('./types').Episode[];
  events: WatchEvent[];
  overrides: WatchOverride[];
  library: LibraryItem[];
  ratings: Rating[];
  watchedService: import('./types').WatchedService[];
  services: import('./types').ServiceDef[];
  availability: AvailabilityEntry[];
  alerts: import('./types').AlertRecord[];
}

export async function loadSnapshot(): Promise<Snapshot> {
  const [titles, metadata, seasons, episodes, events, overrides, library, ratings, watchedService, services, availability, alerts] = await Promise.all([
    repo.allTitles(), repo.allMetadata(), repo.allSeasons(), repo.allEpisodes(), repo.allEvents(), repo.allOverrides(),
    repo.allLibrary(), repo.allRatings(), repo.allWatchedService(), repo.allServices(), repo.allAvailability(), repo.allAlerts()
  ]);
  return { titles, metadata, seasons, episodes, events, overrides, library, ratings, watchedService, services, availability, alerts };
}

export function titleStatus(s: Snapshot, titleId: string): SeriesStatus | 'Finished' | 'To Watch' {
  const title = s.titles.find((t) => t.id === titleId);
  if (!title) return 'To Watch';
  if (title.mediaType === 'movie') {
    return resolveMovie(titleId, s.events, s.overrides).watched ? 'Finished' : 'To Watch';
  }
  const meta = s.metadata.find((m) => m.titleId === titleId);
  const episodes = s.episodes.filter((e) => e.titleId === titleId);
  return computeSeriesStatus({ titleId, episodes, metadataStatus: meta?.status ?? 'Returning Series', events: s.events, overrides: s.overrides });
}

export function genresOf(s: Snapshot, titleId: string): string[] {
  return s.metadata.find((m) => m.titleId === titleId)?.genres ?? [];
}

export function currentAvailability(s: Snapshot, titleId: string): AvailabilityEntry[] {
  return s.availability.filter((a) => a.titleId === titleId);
}

/** Selected-service subscription entries first (Correction 4/5/6: "prioritize the user's
 * selected services visually"), then everything else. */
export function prioritizedAvailability(s: Snapshot, titleId: string): AvailabilityEntry[] {
  const selectedKeys = new Set(s.services.filter((sv) => sv.userSelected).map((sv) => sv.serviceKey));
  return [...currentAvailability(s, titleId)].sort((a, b) => {
    const aSel = selectedKeys.has(a.serviceKey) ? 0 : 1;
    const bSel = selectedKeys.has(b.serviceKey) ? 0 : 1;
    return aSel - bSel;
  });
}

/** The single best "Open in <Service>" action for the Detail page's primary streaming button
 * (Correction 9): a user-selected service with a subscription deep link, else any subscription
 * deep link, else null (no fake working button when nothing is actionable). */
export function primaryStreamingAction(s: Snapshot, titleId: string): AvailabilityEntry | null {
  const entries = prioritizedAvailability(s, titleId).filter((a) => a.optionType === 'subscription' && a.deepLink);
  return entries[0] ?? null;
}

// --- Home --------------------------------------------------------------------------------

export interface WatchingCard {
  title: Title;
  status: SeriesStatus;
  seasonNumber: number;
  watchedInSeason: number;
  totalInSeason: number;
  lastWatchedAt: string | null;
}

/** Shared by watchingNow/onHold (Correction 3): the season shown on a card is always the
 * relevant one per section 4.5's priority order, and its progress always respects manual
 * overrides — never a hardcoded/placeholder season number. */
function buildCard(s: Snapshot, title: Title, status: SeriesStatus): WatchingCard {
  const episodes = s.episodes.filter((e) => e.titleId === title.id);
  const seasons = s.seasons.filter((se) => se.titleId === title.id);
  const seasonNumber = computeRelevantSeason(title.id, seasons, episodes, s.events, s.overrides) ?? 1;
  const progress = seasonProgress(title.id, seasonNumber, episodes, s.events, s.overrides);
  return {
    title,
    status,
    seasonNumber,
    watchedInSeason: progress.watched,
    totalInSeason: progress.total,
    lastWatchedAt: lastRealWatchedAt(title.id, s.events)
  };
}

export function watchingNow(s: Snapshot): WatchingCard[] {
  return s.library
    .map((i) => s.titles.find((t) => t.id === i.titleId))
    .filter((t): t is Title => !!t && t.mediaType === 'series')
    .filter((t) => titleStatus(s, t.id) === 'Watching')
    .map((title) => buildCard(s, title, 'Watching'))
    .sort((a, b) => (b.lastWatchedAt ?? '').localeCompare(a.lastWatchedAt ?? ''));
}

export function onHold(s: Snapshot): WatchingCard[] {
  return s.library
    .map((i) => s.titles.find((t) => t.id === i.titleId))
    .filter((t): t is Title => !!t && t.mediaType === 'series')
    .filter((t) => titleStatus(s, t.id) === 'On Hold')
    .map((title) => buildCard(s, title, 'On Hold'))
    .sort((a, b) => (b.lastWatchedAt ?? '').localeCompare(a.lastWatchedAt ?? ''));
}

export function rateNow(s: Snapshot, mediaType: MediaType): Title[] {
  return s.library
    .map((i) => s.titles.find((t) => t.id === i.titleId))
    .filter((t): t is Title => !!t && t.mediaType === mediaType)
    .filter((t) => !s.ratings.some((r) => r.titleId === t.id))
    .filter((t) => isFullyWatchedForRating(titleStatus(s, t.id) as SeriesStatus) || titleStatus(s, t.id) === 'Finished');
}

export function resolveRateNowMedia(current: MediaType, seriesCount: number, movieCount: number): MediaType {
  if (current === 'series' && seriesCount === 0 && movieCount > 0) return 'movie';
  if (current === 'movie' && movieCount === 0 && seriesCount > 0) return 'series';
  return current;
}

export interface NewSeasonCard {
  title: Title;
  seasonNumber: number;
  releaseState: 'upcoming' | 'released';
  firstAirDate: string | null;
}

export function newSeason(s: Snapshot): NewSeasonCard[] {
  const out: NewSeasonCard[] = [];
  for (const item of s.library) {
    const title = s.titles.find((t) => t.id === item.titleId);
    if (!title || title.mediaType !== 'series') continue;
    const seasons = s.seasons.filter((se) => se.titleId === title.id);
    const entry = computeNewSeasonEntry(title.id, seasons, s.episodes, s.events, s.overrides);
    if (entry) out.push({ title, seasonNumber: entry.seasonNumber, releaseState: entry.releaseState, firstAirDate: entry.firstAirDate });
  }
  return out;
}

// --- History -------------------------------------------------------------------------------

export interface HistoryEntry extends HistoryRow {
  title: Title;
  watchedService?: string;
}

export function historyRows(s: Snapshot, mediaType: MediaType): HistoryEntry[] {
  const rows: HistoryEntry[] = [];
  for (const title of s.titles.filter((t) => t.mediaType === mediaType)) {
    const row = buildHistoryRow(title, s.episodes, s.events, s.overrides);
    if (!row) continue;
    rows.push({ ...row, title, watchedService: s.watchedService.find((w) => w.titleId === title.id)?.serviceKey });
  }
  return rows;
}

export { sortRecentlyWatched };

// --- Library ------------------------------------------------------------------------------

export interface LibraryEntry {
  title: Title;
  status: SeriesStatus;
  rating?: number;
  addedAt: string;
  lastWatchedAt: string | null;
  availability: AvailabilityEntry[];
}

export function libraryRows(s: Snapshot, mediaType: MediaType): LibraryEntry[] {
  return s.library
    .map((item): LibraryEntry | null => {
      const title = s.titles.find((t) => t.id === item.titleId);
      if (!title || title.mediaType !== mediaType) return null;
      return {
        title,
        status: titleStatus(s, title.id) as SeriesStatus,
        rating: s.ratings.find((r) => r.titleId === title.id)?.stars,
        addedAt: item.addedAt,
        lastWatchedAt: lastRealWatchedAt(title.id, s.events),
        availability: currentAvailability(s, title.id)
      };
    })
    .filter((x): x is LibraryEntry => !!x);
}

// --- Discover -------------------------------------------------------------------------------

export function discoverContext(s: Snapshot): Discover.DiscoverContext {
  const historyTitleIds = new Set(historyRows(s, 'series').map((r) => r.titleId).concat(historyRows(s, 'movie').map((r) => r.titleId)));
  return { titles: s.titles, metadata: s.metadata, libraryItems: s.library, historyTitleIds, availability: s.availability, services: s.services, ratings: s.ratings };
}

export { Discover };
