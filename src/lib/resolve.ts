// Resolved watch state (section 9.1): manual override wins, else provider event, else unwatched.
import type { WatchEvent, WatchOverride } from './types.js';

export interface ResolvedState {
  watched: boolean;
  watchedAt: string | null; // real provider timestamp only, never fabricated
  viaOverride: boolean;
}

function findEpisodeOverride(overrides: WatchOverride[], titleId: string, season: number, episode: number): WatchOverride | undefined {
  // episode-level override wins; otherwise a season-level override applies to all its episodes.
  const direct = overrides.find((o) => o.scopeType === 'episode' && o.titleId === titleId && o.seasonNumber === season && o.episodeNumber === episode);
  if (direct) return direct;
  return overrides
    .filter((o) => o.scopeType === 'season' && o.titleId === titleId && o.seasonNumber === season)
    .sort((a, b) => (a.changedAt < b.changedAt ? 1 : -1))[0];
}

export function resolveEpisode(
  titleId: string,
  season: number,
  episode: number,
  events: WatchEvent[],
  overrides: WatchOverride[]
): ResolvedState {
  const override = findEpisodeOverride(overrides, titleId, season, episode);
  const event = events.find((e) => e.titleId === titleId && e.seasonNumber === season && e.episodeNumber === episode);
  if (override) {
    return { watched: override.state === 'watched', watchedAt: event?.watchedAt ?? null, viaOverride: true };
  }
  if (event) return { watched: true, watchedAt: event.watchedAt, viaOverride: false };
  return { watched: false, watchedAt: null, viaOverride: false };
}

export function resolveMovie(titleId: string, events: WatchEvent[], overrides: WatchOverride[]): ResolvedState {
  const override = overrides.find((o) => o.scopeType === 'movie' && o.titleId === titleId);
  const event = events.find((e) => e.titleId === titleId && e.seasonNumber === undefined);
  if (override) {
    return { watched: override.state === 'watched', watchedAt: event?.watchedAt ?? null, viaOverride: true };
  }
  if (event) return { watched: true, watchedAt: event.watchedAt, viaOverride: false };
  return { watched: false, watchedAt: null, viaOverride: false };
}

/** Latest activity timestamp for a title — used only for the 14-day On Hold rule, never displayed
 * as a watched date. Includes override changedAt so a manual correction counts as activity. */
export function lastActivityAt(titleId: string, events: WatchEvent[], overrides: WatchOverride[]): string | null {
  const dates: string[] = [
    ...events.filter((e) => e.titleId === titleId).map((e) => e.watchedAt),
    ...overrides.filter((o) => o.titleId === titleId).map((o) => o.changedAt)
  ];
  if (dates.length === 0) return null;
  return dates.sort().at(-1)!;
}

/** Latest real provider watched timestamp only (for display: last watched date). */
export function lastRealWatchedAt(titleId: string, events: WatchEvent[]): string | null {
  const dates = events.filter((e) => e.titleId === titleId).map((e) => e.watchedAt);
  if (dates.length === 0) return null;
  return dates.sort().at(-1)!;
}
