// Shared season-selection / progress helpers used by both the status engine (status.ts) and the
// UI (Home Watching Now/On Hold cards, Detail Episodes tab). Extracted so "which season is the
// user actually on" is computed exactly once and tested once (Correction 10).
import type { Episode } from './types.js';
import { resolveEpisode } from './resolve.js';
import type { WatchEvent, WatchOverride } from './types.js';

export interface ReleasedEpisode extends Episode {}

function releasedOf(episodes: Episode[], now: Date): Episode[] {
  return episodes.filter((e) => e.airDate && new Date(e.airDate) <= now);
}

/** Highest season number (among released episodes) that has at least one watched episode, or
 * null if the user hasn't watched anything yet. This is the "engaged" season — the one the user
 * has actually started — as opposed to any season that merely exists or has released. */
export function engagedSeasonNumber(
  titleId: string,
  episodes: Episode[],
  events: WatchEvent[],
  overrides: WatchOverride[],
  now: Date = new Date()
): number | null {
  const released = releasedOf(episodes, now);
  const seasonNumbers = [...new Set(released.map((e) => e.seasonNumber))].sort((a, b) => a - b);
  let engaged: number | null = null;
  for (const sn of seasonNumbers) {
    const eps = released.filter((e) => e.seasonNumber === sn);
    if (eps.some((e) => resolveEpisode(titleId, sn, e.episodeNumber, events, overrides).watched)) engaged = sn;
  }
  return engaged;
}

/** Section 4.5 default season selection: current active season (one the user has actually
 * started and not finished) -> latest season with released unwatched episodes -> latest
 * released season. Never picks the newest unwatched season out from under an earlier season the
 * user is actively mid-way through. */
export function computeRelevantSeason(
  titleId: string,
  seasons: { seasonNumber: number }[],
  episodes: Episode[],
  events: WatchEvent[],
  overrides: WatchOverride[],
  now: Date = new Date()
): number | null {
  const released = releasedOf(episodes, now);
  if (released.length === 0) {
    return seasons.length ? Math.min(...seasons.map((s) => s.seasonNumber)) : null;
  }
  const seasonNumbers = [...new Set(released.map((e) => e.seasonNumber))].sort((a, b) => a - b);

  const engaged = engagedSeasonNumber(titleId, episodes, events, overrides, now);
  if (engaged !== null) {
    const eps = released.filter((e) => e.seasonNumber === engaged);
    const allWatched = eps.every((e) => resolveEpisode(titleId, engaged, e.episodeNumber, events, overrides).watched);
    if (!allWatched) return engaged; // priority 1: actively watching this season
  }

  const withUnwatched = seasonNumbers.filter((sn) =>
    released.some((e) => e.seasonNumber === sn && !resolveEpisode(titleId, sn, e.episodeNumber, events, overrides).watched)
  );
  if (withUnwatched.length > 0) return withUnwatched.at(-1)!; // priority 2: latest season with released-unwatched episodes

  return seasonNumbers.at(-1)!; // priority 3: latest released season
}

/** Watched/total counts for one season's released episodes, respecting manual overrides. */
export function seasonProgress(
  titleId: string,
  seasonNumber: number,
  episodes: Episode[],
  events: WatchEvent[],
  overrides: WatchOverride[],
  now: Date = new Date()
): { watched: number; total: number } {
  const released = releasedOf(episodes, now).filter((e) => e.seasonNumber === seasonNumber);
  const watched = released.filter((e) => resolveEpisode(titleId, seasonNumber, e.episodeNumber, events, overrides).watched).length;
  return { watched, total: released.length };
}
