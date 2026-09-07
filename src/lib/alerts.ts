// Alert engine (section 11). Deterministic and CHANGE-DETECTED: every alert is produced by
// comparing a previous provider snapshot against the current one, not by re-asserting whatever
// is currently true. Re-processing the same snapshot twice must never create duplicate alerts —
// enforced both by dedupeKey (belt) and by only reacting to genuine before/after differences
// (suspenders).
import type {
  AlertRecord,
  AlertType,
  AvailabilityEntry,
  Episode,
  LibraryItem,
  Season,
  SeriesStatus,
  ServiceDef,
  Title,
  TitleMetadata,
  WatchEvent,
  WatchOverride
} from './types.js';
import { computeSeriesStatus } from './status.js';
import { resolveMovie } from './resolve.js';

const MAX_ALERTS = 30;
const LEAVING_SOON_WINDOW_DAYS = 30;

let seq = 1;
function nextId() {
  return `alert-${Date.now()}-${seq++}`;
}

/** One season's release-relevant facts as of a snapshot. `exists` and `airDate: null` are
 * deliberately distinct states — "the season did not exist yet" must never be collapsed into
 * "the season exists with no known date," or a brand-new season's very first appearance in the
 * catalogue would be indistinguishable from an already-known season simply still lacking a date. */
export interface SeasonSnapshotEntry {
  exists: boolean;
  airDate: string | null;
  /** True once the season has at least one released (aired) episode as of the snapshot time —
   * i.e. it has genuinely crossed from upcoming/not-yet-available into available. */
  available: boolean;
}

/** A compact snapshot of "release" facts worth diffing: one entry per movie, one per series
 * season. Built fresh from titles/metadata/seasons/episodes each time and persisted by the caller
 * (repo.ts) so the next run has something to compare against. */
export interface ReleaseSnapshot {
  movieReleaseDates: Record<string, string | null>; // titleId -> releaseDate
  seasons: Record<string, SeasonSnapshotEntry>; // `${titleId}:${seasonNumber}` -> snapshot entry
}

export function buildReleaseSnapshot(
  titles: Title[],
  metadata: TitleMetadata[],
  seasons: Season[],
  episodes: Episode[],
  now: Date = new Date()
): ReleaseSnapshot {
  const movieReleaseDates: Record<string, string | null> = {};
  for (const t of titles) {
    if (t.mediaType !== 'movie') continue;
    movieReleaseDates[t.id] = metadata.find((m) => m.titleId === t.id)?.releaseDate ?? null;
  }
  const seasonsOut: Record<string, SeasonSnapshotEntry> = {};
  for (const s of seasons) {
    const key = `${s.titleId}:${s.seasonNumber}`;
    const available = episodes.some((e) => e.titleId === s.titleId && e.seasonNumber === s.seasonNumber && e.airDate && new Date(e.airDate) <= now);
    seasonsOut[key] = { exists: true, airDate: s.airDate ?? null, available };
  }
  return { movieReleaseDates, seasons: seasonsOut };
}

const EMPTY_SEASON_SNAPSHOT: SeasonSnapshotEntry = { exists: false, airDate: null, available: false };

function fmt(dateIso: string): string {
  return new Date(dateIso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export interface AlertContext {
  now?: Date;
  titles: Title[];
  metadata: TitleMetadata[];
  libraryItems: LibraryItem[];
  seasons: Season[];
  episodes: Episode[];
  events: WatchEvent[];
  overrides: WatchOverride[];
  services: ServiceDef[];
  existingAlerts: AlertRecord[];

  /** Availability as of the previous check. Pass the same array as `currentAvailability` on the
   * very first run so nothing false-fires as "newly available". */
  previousAvailability: AvailabilityEntry[];
  currentAvailability: AvailabilityEntry[];

  /** Release-date facts as of the previous check (see buildReleaseSnapshot). Pass a snapshot
   * equal to the current one on the very first run. */
  previousRelease: ReleaseSnapshot;
  currentRelease: ReleaseSnapshot;

  /** Wall-clock time of the previous check — episodes whose airDate falls in
   * (previousCheckAt, now] are "newly available" for the new-episode-available alert. Pass `now`
   * itself on the very first run so nothing retroactively fires for old episodes. */
  previousCheckAt: Date;
}

function makeAlert(titleId: string, alertType: AlertType, message: string, eventDate: string | null, dedupeKey: string, now: Date): AlertRecord {
  return { id: nextId(), titleId, alertType, message, eventDate, createdAt: now.toISOString(), seenAt: null, dedupeKey };
}

/** Returns only genuinely new alerts (not already present by dedupeKey and derived from an
 * actual previous-vs-current change). Does not mutate input. */
export function generateAlerts(ctx: AlertContext): AlertRecord[] {
  const now = ctx.now ?? new Date();
  const existingKeys = new Set(ctx.existingAlerts.map((a) => a.dedupeKey));
  const out: AlertRecord[] = [];
  const push = (titleId: string, alertType: AlertType, message: string, eventDate: string | null, dedupeKey: string) => {
    if (existingKeys.has(dedupeKey)) return;
    existingKeys.add(dedupeKey); // guard against two alerts computed in this same pass colliding
    out.push(makeAlert(titleId, alertType, message, eventDate, dedupeKey, now));
  };

  const libraryIds = new Set(ctx.libraryItems.map((i) => i.titleId));
  const selectedServiceKeys = new Set(ctx.services.filter((s) => s.userSelected).map((s) => s.serviceKey));

  const statusOf = (titleId: string): SeriesStatus | 'Finished' | 'To Watch' => {
    const title = ctx.titles.find((t) => t.id === titleId);
    if (!title) return 'To Watch';
    const meta = ctx.metadata.find((m) => m.titleId === titleId);
    const episodes = ctx.episodes.filter((e) => e.titleId === titleId);
    return computeSeriesStatus({ titleId, episodes, metadataStatus: meta?.status ?? 'Returning Series', events: ctx.events, overrides: ctx.overrides, now });
  };

  // --- New season discovered / release-date added / changed / available — all series in My
  // Library. Every one of these is a genuine before-vs-after transition on the persisted
  // ReleaseSnapshot — never a re-assertion of whatever the current snapshot already says, so a
  // season that was already known as of the previous check (including on the very first sync,
  // where previousRelease === currentRelease by construction) never fires here again.
  for (const titleId of libraryIds) {
    const title = ctx.titles.find((t) => t.id === titleId);
    if (!title || title.mediaType !== 'series') continue;
    const seasons = ctx.seasons.filter((s) => s.titleId === titleId);

    for (const season of seasons) {
      const key = `${titleId}:${season.seasonNumber}`;
      const prev = ctx.previousRelease.seasons[key] ?? EMPTY_SEASON_SNAPSHOT;
      const curr = ctx.currentRelease.seasons[key] ?? EMPTY_SEASON_SNAPSHOT;

      // New season discovered: it did not exist in the previous snapshot at all (works even
      // before episode records or an exact air date exist for it).
      if (!prev.exists && curr.exists) {
        push(
          titleId, 'new_season_announced',
          curr.airDate ? `Season ${season.seasonNumber} announced — releases ${fmt(curr.airDate)}` : `Season ${season.seasonNumber} announced`,
          curr.airDate, `${titleId}:new_season_discovered:${season.seasonNumber}`
        );
      } else if (prev.exists && curr.exists) {
        // Release date added/changed on an already-known season.
        if (prev.airDate === null && curr.airDate !== null) {
          push(titleId, 'new_season_announced', `Season ${season.seasonNumber} release date added: ${fmt(curr.airDate)}`, curr.airDate, `${titleId}:season_date_added:${season.seasonNumber}:${curr.airDate}`);
        } else if (prev.airDate !== null && curr.airDate !== null && prev.airDate !== curr.airDate) {
          const delayed = new Date(curr.airDate) > new Date(prev.airDate);
          push(
            titleId, 'new_season_announced',
            `Season ${season.seasonNumber} release ${delayed ? 'delayed' : 'moved earlier'} from ${fmt(prev.airDate)} to ${fmt(curr.airDate)}`,
            curr.airDate, `${titleId}:season_date_changed:${season.seasonNumber}:${curr.airDate}`
          );
        }
      }

      // New season available: it genuinely crossed from not-yet-available to available between
      // the previous check and now.
      if (!prev.available && curr.available) {
        push(titleId, 'new_season_available', `Season ${season.seasonNumber} is available now`, curr.airDate, `${titleId}:new_season_available:${season.seasonNumber}`);
      }
    }
  }

  // --- Movie release date announced / changed / delayed / moved earlier — all My Library movies.
  for (const titleId of libraryIds) {
    const title = ctx.titles.find((t) => t.id === titleId);
    if (!title || title.mediaType !== 'movie') continue;
    const prevDate = ctx.previousRelease.movieReleaseDates[titleId] ?? null;
    const currDate = ctx.currentRelease.movieReleaseDates[titleId] ?? null;
    if (currDate === prevDate) continue;
    if (prevDate === null && currDate !== null) {
      push(titleId, 'movie_release_announced', `Release date added: ${fmt(currDate)}`, currDate, `${titleId}:movie_release_announced:${currDate}`);
    } else if (prevDate !== null && currDate !== null) {
      const delayed = new Date(currDate) > new Date(prevDate);
      push(
        titleId, 'movie_release_changed',
        `Release ${delayed ? 'delayed' : 'moved earlier'} from ${fmt(prevDate)} to ${fmt(currDate)}`,
        currDate, `${titleId}:movie_release_changed:${currDate}`
      );
    }
  }

  // --- New episode available — ONLY series currently Watching, only truly newly-released eps. --
  for (const titleId of libraryIds) {
    const title = ctx.titles.find((t) => t.id === titleId);
    if (!title || title.mediaType !== 'series') continue;
    if (statusOf(titleId) !== 'Watching') continue;
    const newlyReleased = ctx.episodes.filter(
      (e) => e.titleId === titleId && e.airDate && new Date(e.airDate) > ctx.previousCheckAt && new Date(e.airDate) <= now
    );
    for (const e of newlyReleased) {
      push(titleId, 'new_episode_available', `S${e.seasonNumber} E${e.episodeNumber} is now available`, e.airDate, `${titleId}:new_episode:${e.seasonNumber}:${e.episodeNumber}`);
    }
  }

  // --- Now available / leaving soon — My Library titles that are NOT Finished. -----------------
  for (const titleId of libraryIds) {
    const title = ctx.titles.find((t) => t.id === titleId);
    if (!title) continue;
    const finished = title.mediaType === 'movie' ? resolveMovie(titleId, ctx.events, ctx.overrides).watched : statusOf(titleId) === 'Finished';
    if (finished) continue;

    for (const av of ctx.currentAvailability.filter((a) => a.titleId === titleId)) {
      if (av.optionType !== 'subscription' || !selectedServiceKeys.has(av.serviceKey)) continue;
      const previous = ctx.previousAvailability.find(
        (p) => p.titleId === titleId && p.serviceKey === av.serviceKey && p.optionType === 'subscription'
      );
      const svc = ctx.services.find((s) => s.serviceKey === av.serviceKey);

      if (!previous) {
        // Include the availability-cycle marker so a title can legitimately leave and later return
        // to the same service without an old alert suppressing the new event forever.
        const cycle = av.startsAt ?? av.checkedAt;
        push(
          titleId, 'now_available', `Now available on ${svc?.displayName ?? av.serviceKey}`, null,
          `${titleId}:now_available:${av.serviceKey}:${cycle}`
        );
      }

      if (av.endsAt) {
        const daysLeft = (new Date(av.endsAt).getTime() - now.getTime()) / 86400000;
        if (daysLeft > 0 && daysLeft <= LEAVING_SOON_WINDOW_DAYS) {
          const previousDaysLeft = previous?.endsAt
            ? (new Date(previous.endsAt).getTime() - ctx.previousCheckAt.getTime()) / 86400000
            : Number.POSITIVE_INFINITY;
          const genuinelyEnteredLeavingWindow =
            !previous?.endsAt ||
            previous.endsAt !== av.endsAt ||
            previousDaysLeft > LEAVING_SOON_WINDOW_DAYS;

          if (genuinelyEnteredLeavingWindow) {
            // The end date is part of the dedupe key so a later, distinct leaving event on the same
            // service is not suppressed by a historical alert for an older availability cycle.
            push(
              titleId, 'leaving_soon', `Leaving ${svc?.displayName ?? av.serviceKey} on ${fmt(av.endsAt)}`, av.endsAt,
              `${titleId}:leaving_soon:${av.serviceKey}:${av.endsAt}`
            );
          }
        }
      }
    }
  }

  return out;
}

export function applyRetention(alerts: AlertRecord[]): AlertRecord[] {
  const sorted = [...alerts].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return sorted.slice(0, MAX_ALERTS);
}
