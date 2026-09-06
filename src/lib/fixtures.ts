// Synthetic catalogue + personal state used to seed the local database on first run.
// Rich enough to exercise every status/alert/discover branch without any live provider call.
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

const DAY = 24 * 60 * 60 * 1000;
export const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();
export const daysFromNow = (n: number) => new Date(Date.now() + n * DAY).toISOString();

const id = (mediaType: 'series' | 'movie', tmdbId: number) => `${mediaType}-${tmdbId}`;

// ---------------------------------------------------------------------------------------------
// Services (Preferences default list, section 6.1)
// ---------------------------------------------------------------------------------------------
export const SERVICES: ServiceDef[] = [
  { serviceKey: 'netflix', displayName: 'Netflix', logoGlyph: 'N', userSelected: true, availabilitySource: 'streaming-availability' },
  { serviceKey: 'hbo-max', displayName: 'HBO Max', logoGlyph: 'H', userSelected: true, availabilitySource: 'streaming-availability' },
  { serviceKey: 'disney-plus', displayName: 'Disney+', logoGlyph: 'D', userSelected: false, availabilitySource: 'streaming-availability' },
  { serviceKey: 'prime-video', displayName: 'Prime Video', logoGlyph: 'P', userSelected: true, availabilitySource: 'streaming-availability' },
  { serviceKey: 'skyshowtime', displayName: 'SkyShowtime', logoGlyph: 'S', userSelected: false, availabilitySource: 'streaming-availability' },
  { serviceKey: 'apple-tv', displayName: 'Apple TV', logoGlyph: 'A', userSelected: true, availabilitySource: 'streaming-availability' },
  { serviceKey: 'viaplay', displayName: 'Viaplay', logoGlyph: 'V', userSelected: false, availabilitySource: 'unsupported' },
  { serviceKey: 'tv4-play', displayName: 'TV4 Play', logoGlyph: 'T4', userSelected: false, availabilitySource: 'unsupported' }
];

// ---------------------------------------------------------------------------------------------
// Titles
// ---------------------------------------------------------------------------------------------
export const TITLES: Title[] = [
  { id: id('series', 1001), mediaType: 'series', tmdbId: 1001, title: 'Nebula Drift', year: 2023 },
  { id: id('series', 1002), mediaType: 'series', tmdbId: 1002, title: 'Harbor Lights', year: 2021 },
  { id: id('series', 1003), mediaType: 'series', tmdbId: 1003, title: 'Quiet Static', year: 2022 },
  { id: id('series', 1004), mediaType: 'series', tmdbId: 1004, title: 'Glass Orchard', year: 2019 },
  { id: id('series', 1005), mediaType: 'series', tmdbId: 1005, title: 'Midnight Foundry', year: 2024 },
  { id: id('series', 1006), mediaType: 'series', tmdbId: 1006, title: 'Solstice Bureau', year: 2025 },
  { id: id('series', 1007), mediaType: 'series', tmdbId: 1007, title: 'Paper Moons', year: 2020 },
  { id: id('series', 1008), mediaType: 'series', tmdbId: 1008, title: 'Rift Valley', year: 2024 },
  { id: id('series', 1009), mediaType: 'series', tmdbId: 1009, title: 'Copper Static', year: 2022 },
  { id: id('movie', 2001), mediaType: 'movie', tmdbId: 2001, title: 'Coral Static', year: 2022 },
  { id: id('movie', 2002), mediaType: 'movie', tmdbId: 2002, title: 'The Long Static', year: 2021 },
  { id: id('movie', 2003), mediaType: 'movie', tmdbId: 2003, title: 'Iron Season', year: 2023 },
  { id: id('movie', 2004), mediaType: 'movie', tmdbId: 2004, title: 'Nightglass', year: 2026 },
  { id: id('movie', 2005), mediaType: 'movie', tmdbId: 2005, title: 'Echo Harbor', year: 2026 },
  { id: id('movie', 2006), mediaType: 'movie', tmdbId: 2006, title: 'Salt & Static', year: 2020 },
  { id: id('movie', 2007), mediaType: 'movie', tmdbId: 2007, title: 'Amber Weather', year: 2019 }
];

const GENRES: Record<string, string[]> = {
  'series-1001': ['Sci-Fi', 'Drama'],
  'series-1002': ['Mystery', 'Drama'],
  'series-1003': ['Comedy'],
  'series-1004': ['Drama', 'Sci-Fi'],
  'series-1005': ['Thriller', 'Crime'],
  'series-1006': ['Sci-Fi', 'Thriller'],
  'series-1007': ['Fantasy', 'Drama'],
  'series-1008': ['Sci-Fi', 'Adventure'],
  'series-1009': ['Crime', 'Drama'],
  'movie-2001': ['Drama'],
  'movie-2002': ['Sci-Fi'],
  'movie-2003': ['Action'],
  'movie-2004': ['Thriller'],
  'movie-2005': ['Drama', 'Mystery'],
  'movie-2006': ['Sci-Fi', 'Comedy'],
  'movie-2007': ['Romance', 'Drama']
};

export const TITLE_METADATA: TitleMetadata[] = TITLES.map((t) => ({
  titleId: t.id,
  status:
    t.id === 'series-1004' ? 'Ended' :
    t.id === 'series-1009' ? 'Ended' :
    t.id === 'movie-2004' ? 'Upcoming' :
    t.id === 'movie-2005' ? 'Upcoming' :
    t.mediaType === 'movie' ? 'Released' : 'Returning Series',
  overview: `Synthetic overview for ${t.title}, used only for local QA fixtures.`,
  genres: GENRES[t.id] ?? ['Drama'],
  posterPath: `poster-${(t.tmdbId % 8) + 1}`,
  backdropPath: `backdrop-${(t.tmdbId % 6) + 1}`,
  trailerKey: t.tmdbId % 3 === 0 ? null : `fake-trailer-${t.tmdbId}`,
  metadataUpdatedAt: daysAgo(1),
  releaseDate: t.id === 'movie-2004' ? daysFromNow(55) : t.id === 'movie-2005' ? daysFromNow(40) : null
}));

// ---------------------------------------------------------------------------------------------
// Seasons / Episodes
// ---------------------------------------------------------------------------------------------
export const SEASONS: Season[] = [];
export const EPISODES: Episode[] = [];

function addSeason(titleId: string, seasonNumber: number, episodeCount: number, airDate: string | null, name?: string) {
  SEASONS.push({ titleId, seasonNumber, tmdbSeasonId: seasonNumber * 100, name: name ?? `Season ${seasonNumber}`, episodeCount, airDate });
}
function addEpisodes(titleId: string, seasonNumber: number, episodeCount: number, releasedCount: number, startDaysAgo: number, spacingDays: number) {
  for (let e = 1; e <= episodeCount; e++) {
    const released = e <= releasedCount;
    const airDate = released
      ? daysAgo(startDaysAgo - (e - 1) * spacingDays > 0 ? startDaysAgo - (e - 1) * spacingDays : 0)
      : daysFromNow((e - releasedCount) * spacingDays);
    EPISODES.push({
      titleId,
      seasonNumber,
      episodeNumber: e,
      tmdbEpisodeId: seasonNumber * 1000 + e,
      name: `Episode ${e}`,
      runtime: 42,
      airDate,
      overview: `Synthetic episode ${e} of season ${seasonNumber}.`
    });
  }
}

// Nebula Drift — Watching: S1 fully released+watched, S2 8 eps, 6 released, watched through E4, last watched 2 days ago
addSeason('series-1001', 1, 8, daysAgo(400));
addEpisodes('series-1001', 1, 8, 8, 380, 7);
addSeason('series-1001', 2, 8, daysAgo(60));
addEpisodes('series-1001', 2, 8, 6, 55, 7);

// Harbor Lights — On Hold: 10 episodes, 8 released, watched through E5, last watched 20 days ago
addSeason('series-1002', 1, 10, daysAgo(200));
addEpisodes('series-1002', 1, 10, 8, 190, 6);

// Quiet Static — Caught Up: 6 episodes released, all watched, series still Returning
addSeason('series-1003', 1, 6, daysAgo(120));
addEpisodes('series-1003', 1, 6, 6, 110, 6);

// Glass Orchard — Finished: 8 episodes, all released & watched, TMDB status Ended
addSeason('series-1004', 1, 8, daysAgo(500));
addEpisodes('series-1004', 1, 8, 8, 480, 6);

// Midnight Foundry — To Watch: 8 released episodes, none watched
addSeason('series-1005', 1, 8, daysAgo(90));
addEpisodes('series-1005', 1, 8, 8, 80, 6);

// Solstice Bureau — Watching, weekly season currently airing (New Season + Watching overlap)
addSeason('series-1006', 1, 8, daysAgo(300));
addEpisodes('series-1006', 1, 8, 8, 280, 6);
addSeason('series-1006', 2, 8, daysAgo(20));
addEpisodes('series-1006', 2, 8, 3, 13, 7); // weekly drop, 5 more episodes still to air

// Paper Moons — Caught Up on S1, S2 announced but not released (New Season upcoming)
addSeason('series-1007', 1, 6, daysAgo(250));
addEpisodes('series-1007', 1, 6, 6, 240, 6);
addSeason('series-1007', 2, 6, daysFromNow(21));
addEpisodes('series-1007', 2, 6, 0, 0, 7);

// Rift Valley — catalogue-only, not in library. 5 episodes released, nothing watched.
addSeason('series-1008', 1, 5, daysAgo(40));
addEpisodes('series-1008', 1, 5, 5, 30, 6);

// Copper Static — Finished, ended series, in History but never added to Library (History-only fixture)
addSeason('series-1009', 1, 6, daysAgo(700));
addEpisodes('series-1009', 1, 6, 6, 680, 6);

// ---------------------------------------------------------------------------------------------
// Watch events (provider-sourced, Trakt-style) + overrides (user-owned, authoritative)
// ---------------------------------------------------------------------------------------------
export const WATCH_EVENTS: WatchEvent[] = [];
export const WATCH_OVERRIDES: WatchOverride[] = [];
let weSeq = 1;
function watchEpisode(titleId: string, seasonNumber: number, episodeNumber: number, watchedAt: string) {
  WATCH_EVENTS.push({ id: `we-${weSeq}`, providerEventId: `prov-${weSeq++}`, titleId, seasonNumber, episodeNumber, watchedAt, source: 'trakt' });
}
function watchMovie(titleId: string, watchedAt: string) {
  WATCH_EVENTS.push({ id: `we-${weSeq}`, providerEventId: `prov-${weSeq++}`, titleId, watchedAt, source: 'trakt' });
}

// Nebula Drift: S1 all watched long ago, S2 E1-E4 watched, most recent 2 days ago
for (let e = 1; e <= 8; e++) watchEpisode('series-1001', 1, e, daysAgo(370 - e * 5));
for (let e = 1; e <= 4; e++) watchEpisode('series-1001', 2, e, daysAgo(20 - e * 4 + 12));
// override: user marked S2E4 watched date corrected — leave as-is (event already exists); add explicit "watched" override with real recent date for clarity
WATCH_OVERRIDES.push({ id: 'ov-1', scopeType: 'episode', titleId: 'series-1001', seasonNumber: 2, episodeNumber: 4, state: 'watched', changedAt: daysAgo(2) });

// Harbor Lights: E1-E5 watched, last one 20 days ago; E6 has a watch_event but user overrode it back to unwatched (override precedence test)
for (let e = 1; e <= 5; e++) watchEpisode('series-1002', 1, e, daysAgo(40 - e * 4));
watchEpisode('series-1002', 1, 6, daysAgo(19));
WATCH_OVERRIDES.push({ id: 'ov-2', scopeType: 'episode', titleId: 'series-1002', seasonNumber: 1, episodeNumber: 6, state: 'unwatched', changedAt: daysAgo(18) });

// Quiet Static: all 6 released watched, most recent 5 days ago
for (let e = 1; e <= 6; e++) watchEpisode('series-1003', 1, e, daysAgo(30 - e * 4));

// Glass Orchard: all 8 watched, most recent 300 days ago (long finished)
for (let e = 1; e <= 8; e++) watchEpisode('series-1004', 1, e, daysAgo(400 - e * 5));

// Solstice Bureau: S1 fully watched, S2 E1-E2 watched (user has started new season -> back in Watching Now)
for (let e = 1; e <= 8; e++) watchEpisode('series-1006', 1, e, daysAgo(260 - e * 5));
watchEpisode('series-1006', 2, 1, daysAgo(9));
watchEpisode('series-1006', 2, 2, daysAgo(2));

// Paper Moons: all 6 S1 episodes watched, most recent 200 days ago
for (let e = 1; e <= 6; e++) watchEpisode('series-1007', 1, e, daysAgo(230 - e * 5));

// Copper Static (History-only, never in Library): all 6 watched, one with unknown date (manual override only)
for (let e = 1; e <= 5; e++) watchEpisode('series-1009', 1, e, daysAgo(650 - e * 5));
WATCH_OVERRIDES.push({ id: 'ov-3', scopeType: 'episode', titleId: 'series-1009', seasonNumber: 1, episodeNumber: 6, state: 'watched', changedAt: daysAgo(600) });

// Movies
watchMovie('movie-2001', daysAgo(10)); // Coral Static — watched, unrated -> Rate Now candidate
watchMovie('movie-2002', daysAgo(300)); // The Long Static — watched, will be rated 5 stars
// Iron Season: to watch, no event
// Nightglass: unreleased, no event
// Echo Harbor: unreleased, no event
// Salt & Static: catalogue-only, no event
WATCH_OVERRIDES.push({ id: 'ov-4', scopeType: 'movie', titleId: 'movie-2007', state: 'watched', changedAt: daysAgo(900) }); // Amber Weather: manual watch, unknown real date

// ---------------------------------------------------------------------------------------------
// Library membership (user-owned)
// ---------------------------------------------------------------------------------------------
export const LIBRARY_ITEMS: LibraryItem[] = [
  'series-1001', 'series-1002', 'series-1003', 'series-1004', 'series-1005', 'series-1006', 'series-1007',
  'movie-2001', 'movie-2002', 'movie-2003', 'movie-2004', 'movie-2005'
].map((titleId, i) => ({ titleId, addedAt: daysAgo(300 - i * 10), derivedStatus: 'To Watch', statusComputedAt: daysAgo(0) }));

// ---------------------------------------------------------------------------------------------
// Ratings
// ---------------------------------------------------------------------------------------------
export const RATINGS: Rating[] = [
  { titleId: 'movie-2002', stars: 5, ratedAt: daysAgo(299) },
  { titleId: 'series-1004', stars: 5, ratedAt: daysAgo(400) },
  { titleId: 'series-1007', stars: 4, ratedAt: daysAgo(190) },
  { titleId: 'movie-2007', stars: 5, ratedAt: daysAgo(890) }
];

// ---------------------------------------------------------------------------------------------
// Where I watched it (user-owned, optional, restricted to selected services)
// ---------------------------------------------------------------------------------------------
export const WATCHED_SERVICE: WatchedService[] = [
  { titleId: 'series-1001', serviceKey: 'netflix', changedAt: daysAgo(370) },
  { titleId: 'series-1004', serviceKey: 'hbo-max', changedAt: daysAgo(400) },
  { titleId: 'movie-2002', serviceKey: 'prime-video', changedAt: daysAgo(300) }
];

// ---------------------------------------------------------------------------------------------
// Availability snapshot (provider-derived, expiring)
// ---------------------------------------------------------------------------------------------
export const AVAILABILITY: AvailabilityEntry[] = [
  { titleId: 'series-1001', serviceKey: 'netflix', optionType: 'subscription', deepLink: 'https://netflix.example/nebula-drift', startsAt: daysAgo(400), endsAt: null, checkedAt: daysAgo(0), source: 'streaming-availability' },
  { titleId: 'series-1002', serviceKey: 'hbo-max', optionType: 'subscription', deepLink: 'https://hbomax.example/harbor-lights', startsAt: daysAgo(200), endsAt: daysFromNow(12), checkedAt: daysAgo(0), source: 'streaming-availability' }, // leaving soon
  { titleId: 'series-1003', serviceKey: 'apple-tv', optionType: 'subscription', deepLink: 'https://appletv.example/quiet-static', startsAt: daysAgo(120), endsAt: null, checkedAt: daysAgo(0), source: 'streaming-availability' },
  { titleId: 'series-1005', serviceKey: 'prime-video', optionType: 'subscription', deepLink: 'https://primevideo.example/midnight-foundry', startsAt: daysAgo(90), endsAt: null, checkedAt: daysAgo(0), source: 'streaming-availability' },
  { titleId: 'series-1006', serviceKey: 'netflix', optionType: 'subscription', deepLink: 'https://netflix.example/solstice-bureau', startsAt: daysAgo(300), endsAt: null, checkedAt: daysAgo(0), source: 'streaming-availability' },
  { titleId: 'series-1008', serviceKey: 'netflix', optionType: 'subscription', deepLink: 'https://netflix.example/rift-valley', startsAt: daysAgo(40), endsAt: null, checkedAt: daysAgo(0), source: 'streaming-availability' }, // Discover eligible (not in Library/History)
  { titleId: 'movie-2003', serviceKey: 'disney-plus', optionType: 'rent', deepLink: null, startsAt: daysAgo(30), endsAt: null, checkedAt: daysAgo(0), source: 'streaming-availability' }, // rent only -> excluded from Discover
  { titleId: 'movie-2006', serviceKey: 'hbo-max', optionType: 'subscription', deepLink: 'https://hbomax.example/salt-and-static', startsAt: daysAgo(15), endsAt: null, checkedAt: daysAgo(0), source: 'streaming-availability' }, // Discover eligible
  { titleId: 'movie-2007', serviceKey: 'skyshowtime', optionType: 'subscription', deepLink: null, startsAt: daysAgo(15), endsAt: null, checkedAt: daysAgo(0), source: 'streaming-availability' } // on non-selected service, not eligible
];

// ---------------------------------------------------------------------------------------------
// Alerts (pre-seeded so the Alerts screen has representative content on first run)
// ---------------------------------------------------------------------------------------------
export const ALERTS: AlertRecord[] = [
  { id: 'al-1', titleId: 'series-1006', alertType: 'new_episode_available', message: 'S2 E3 is now available', eventDate: daysAgo(2), createdAt: daysAgo(2), seenAt: null, dedupeKey: 'series-1006:new_episode:2:3' },
  { id: 'al-2', titleId: 'series-1007', alertType: 'new_season_announced', message: 'Season 2 announced — release date in 21 days', eventDate: daysFromNow(21), createdAt: daysAgo(5), seenAt: null, dedupeKey: 'series-1007:new_season_announced:2' },
  { id: 'al-3', titleId: 'series-1002', alertType: 'leaving_soon', message: 'Leaving HBO Max in 12 days', eventDate: daysFromNow(12), createdAt: daysAgo(1), seenAt: null, dedupeKey: 'series-1002:leaving_soon:hbo-max' },
  { id: 'al-4', titleId: 'movie-2005', alertType: 'movie_release_changed', message: 'Release delayed — new date in 40 days', eventDate: daysFromNow(40), createdAt: daysAgo(9), seenAt: daysAgo(8), dedupeKey: 'movie-2005:release_changed:40' },
  { id: 'al-5', titleId: 'movie-2004', alertType: 'movie_release_announced', message: 'Release date added — in 55 days', eventDate: daysFromNow(55), createdAt: daysAgo(14), seenAt: daysAgo(13), dedupeKey: 'movie-2004:release_announced:55' },
  { id: 'al-6', titleId: 'series-1005', alertType: 'now_available', message: 'Now available on Prime Video', eventDate: daysAgo(3), createdAt: daysAgo(3), seenAt: daysAgo(2), dedupeKey: 'series-1005:now_available:prime-video' }
];
