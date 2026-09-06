// History aggregation (section 9.2 / 4.4): one row per title, deduplicated, rewatch events kept
// underneath for the detail page's History tab.
import type { Episode, Title, WatchEvent, WatchOverride } from './types.js';
import { lastRealWatchedAt, resolveEpisode, resolveMovie } from './resolve.js';

export interface HistoryRow {
  titleId: string;
  mediaType: 'series' | 'movie';
  watchedReleasedCount: number; // series only
  totalReleasedCount: number; // series only
  lastWatchedAt: string | null; // real timestamp only, never fabricated
  hasAnyWatched: boolean;
}

export function buildHistoryRow(
  title: Title,
  episodes: Episode[],
  events: WatchEvent[],
  overrides: WatchOverride[],
  now: Date = new Date()
): HistoryRow | null {
  if (title.mediaType === 'movie') {
    const resolved = resolveMovie(title.id, events, overrides);
    if (!resolved.watched) return null;
    return {
      titleId: title.id,
      mediaType: 'movie',
      watchedReleasedCount: 0,
      totalReleasedCount: 0,
      lastWatchedAt: lastRealWatchedAt(title.id, events),
      hasAnyWatched: true
    };
  }

  const released = episodes.filter((e) => e.titleId === title.id && e.airDate && new Date(e.airDate) <= now);
  const resolved = released.map((e) => resolveEpisode(title.id, e.seasonNumber, e.episodeNumber, events, overrides));
  const watchedCount = resolved.filter((r) => r.watched).length;
  if (watchedCount === 0) return null;
  return {
    titleId: title.id,
    mediaType: 'series',
    watchedReleasedCount: watchedCount,
    totalReleasedCount: released.length,
    lastWatchedAt: lastRealWatchedAt(title.id, events),
    hasAnyWatched: true
  };
}

/** Recently Watched sort: known dates first (desc), unknown dates after (stable by title). */
export function sortRecentlyWatched<T extends { lastWatchedAt: string | null; titleName: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.lastWatchedAt && b.lastWatchedAt) return a.lastWatchedAt < b.lastWatchedAt ? 1 : -1;
    if (a.lastWatchedAt && !b.lastWatchedAt) return -1;
    if (!a.lastWatchedAt && b.lastWatchedAt) return 1;
    return a.titleName.localeCompare(b.titleName);
  });
}
