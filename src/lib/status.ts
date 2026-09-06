// Status engine (build plan section 5). Pure functions over plain arrays so they are cheap to
// unit test without touching IndexedDB.
import type { Episode, Season, SeriesStatus, Title, TitleMetadata, WatchEvent, WatchOverride } from './types.js';
import { lastRealWatchedAt, resolveEpisode } from './resolve.js';
import { engagedSeasonNumber } from './season-select.js';

const ON_HOLD_DAYS = 14;
const NEW_SEASON_GRACE_DAYS = 14;

export interface SeriesStatusInput {
  titleId: string;
  episodes: Episode[]; // all episodes for this title
  metadataStatus: TitleMetadata['status'];
  events: WatchEvent[];
  overrides: WatchOverride[];
  now?: Date;
}

/**
 * Correction 2 (regression fix): a newly released/announced season must never by itself move a
 * Caught Up series into Watching or On Hold. Only real viewing activity does that. So instead of
 * asking "are there any released-unwatched episodes anywhere" (which a brand-new, untouched
 * season would trivially satisfy), we ask "is the season the user has actually engaged with
 * (the highest season with at least one watched episode) itself incomplete". A newer season that
 * released with zero watched episodes is simply not "engaged" yet and does not affect status.
 *
 * Final-pass fix: "engaged season fully watched" is NOT enough on its own — that ignored gaps in
 * OLDER seasons (e.g. S1E2 left unwatched while S2 is fully watched would wrongly read as Caught
 * Up, because only S2 — the highest touched season — was checked). Caught Up requires every
 * released episode in every season UP TO AND INCLUDING the engaged season to be watched. Only an
 * entirely untouched season strictly newer than the engaged one (zero watched episodes, so it's
 * simply not "engaged" yet) is allowed to sit unwatched without affecting status.
 */
export function computeSeriesStatus(input: SeriesStatusInput): SeriesStatus {
  const now = input.now ?? new Date();
  const released = input.episodes.filter((e) => e.airDate && new Date(e.airDate) <= now);
  if (released.length === 0) return 'To Watch';

  const resolved = released.map((e) => resolveEpisode(input.titleId, e.seasonNumber, e.episodeNumber, input.events, input.overrides));
  const watchedCount = resolved.filter((r) => r.watched).length;
  // Product rule: Finished is reserved for provider status Ended. A Canceled series can still be
  // fully watched, but it remains Caught Up rather than being silently equated with Ended.
  const ended = input.metadataStatus === 'Ended';

  if (watchedCount === 0) return 'To Watch';
  if (watchedCount === released.length) return ended ? 'Finished' : 'Caught Up';

  const engaged = engagedSeasonNumber(input.titleId, input.episodes, input.events, input.overrides, now);
  if (engaged === null) return 'To Watch'; // unreachable given watchedCount > 0, but keeps this total

  // Everything released in the engaged season OR EARLIER must be watched — a gap anywhere at or
  // before the season the user has actually reached is genuine unfinished viewing, not an
  // untouched future season.
  const releasedUpToEngaged = released.filter((e) => e.seasonNumber <= engaged);
  const upToEngagedFullyWatched = releasedUpToEngaged.every(
    (e) => resolveEpisode(input.titleId, e.seasonNumber, e.episodeNumber, input.events, input.overrides).watched
  );
  if (upToEngagedFullyWatched) {
    // Any newer, untouched season with released-but-never-started episodes does not drag status
    // down — still Caught Up.
    return 'Caught Up';
  }

  // A genuine gap exists at or before the engaged season: real in-progress viewing.
  // On Hold only if there has been no ACTUAL WATCHING activity for 14+ days — a manual
  // correction's changedAt is provenance for the correction, not a watched timestamp, so it must
  // never be used to fabricate recent viewing activity here.
  const activity = lastRealWatchedAt(input.titleId, input.events);
  if (!activity) return 'Watching'; // no genuine watched timestamp to judge staleness against
  const daysSinceActivity = (now.getTime() - new Date(activity).getTime()) / 86400000;
  return daysSinceActivity >= ON_HOLD_DAYS ? 'On Hold' : 'Watching';
}

export interface NewSeasonEntry {
  titleId: string;
  seasonNumber: number;
  releaseState: 'upcoming' | 'released';
  finaleAirDate: string | null;
  firstAirDate: string | null;
}

/** Section 5.2 New Season retention. Only seasons numbered 2+ count as a "new season" event —
 * season 1 is just the series itself, not an announcement. */
export function computeNewSeasonEntry(
  titleId: string,
  seasons: Season[],
  episodes: Episode[],
  events: WatchEvent[],
  overrides: WatchOverride[],
  now: Date = new Date()
): NewSeasonEntry | null {
  const candidateSeasons = seasons.filter((s) => s.seasonNumber >= 2).sort((a, b) => b.seasonNumber - a.seasonNumber);
  for (const season of candidateSeasons) {
    const eps = episodes.filter((e) => e.titleId === titleId && e.seasonNumber === season.seasonNumber);
    const episodeAirDates = eps.map((e) => e.airDate).filter((d): d is string => !!d).sort();
    const knownStartDates = [season.airDate, ...episodeAirDates].filter((d): d is string => !!d).sort();
    const firstAirDate = knownStartDates[0] ?? null;
    const finaleAirDate = episodeAirDates.at(-1) ?? firstAirDate;

    // A provider may know a future season before episode records exist. That still belongs in New
    // Season: with a date it is a dated upcoming season; without one it is simply "coming".
    if (eps.length === 0) {
      if (!firstAirDate || new Date(firstAirDate) > now) {
        return { titleId, seasonNumber: season.seasonNumber, releaseState: 'upcoming', finaleAirDate, firstAirDate };
      }
      const expiry = new Date(new Date(firstAirDate).getTime() + NEW_SEASON_GRACE_DAYS * 86400000);
      if (now <= expiry) {
        return { titleId, seasonNumber: season.seasonNumber, releaseState: 'released', finaleAirDate, firstAirDate };
      }
      continue;
    }

    const released = eps.filter((e) => e.airDate && new Date(e.airDate) <= now);
    const seasonHasStarted = !!firstAirDate && new Date(firstAirDate) <= now;
    if (released.length === 0 && !seasonHasStarted) {
      return { titleId, seasonNumber: season.seasonNumber, releaseState: 'upcoming', finaleAirDate, firstAirDate };
    }

    const allKnownEpisodesReleased = released.length === eps.length && eps.length > 0;
    const resolved = released.map((e) => resolveEpisode(titleId, e.seasonNumber, e.episodeNumber, events, overrides));
    const fullyWatched = released.length > 0 && resolved.every((r) => r.watched) && allKnownEpisodesReleased;
    if (fullyWatched) continue; // completed earlier than the retention window -> remove immediately

    // Weekly seasons remain through the release run plus 14 days after the latest known episode.
    // If episode detail is incomplete, fall back to the season start date rather than dropping a
    // provider-known season from Home entirely.
    if (finaleAirDate) {
      const expiry = new Date(new Date(finaleAirDate).getTime() + NEW_SEASON_GRACE_DAYS * 86400000);
      if (now > expiry) continue;
    }
    return { titleId, seasonNumber: season.seasonNumber, releaseState: 'released', finaleAirDate, firstAirDate };
  }
  return null;
}

export function isFullyWatchedForRating(status: SeriesStatus): boolean {
  return status === 'Caught Up' || status === 'Finished';
}
