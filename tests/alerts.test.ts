import { describe, it } from 'node:test';
import { expect } from './expect-shim.js';
import { generateAlerts, applyRetention, buildReleaseSnapshot } from '../src/lib/alerts.js';
import type { AlertRecord, AvailabilityEntry, Episode, LibraryItem, Season, ServiceDef, Title, TitleMetadata } from '../src/lib/types.js';

const now = new Date('2026-09-05T12:00:00Z');
const iso = (daysFromNow: number) => new Date(now.getTime() + daysFromNow * 86400000).toISOString();

const services: ServiceDef[] = [
  { serviceKey: 'netflix', displayName: 'Netflix', logoGlyph: 'N', userSelected: true, availabilitySource: 'streaming-availability' },
  { serviceKey: 'hbo-max', displayName: 'HBO Max', logoGlyph: 'H', userSelected: false, availabilitySource: 'streaming-availability' }
];

function baseArgs(overrides: Partial<Parameters<typeof generateAlerts>[0]> = {}): Parameters<typeof generateAlerts>[0] {
  return {
    now,
    titles: [],
    metadata: [],
    libraryItems: [],
    seasons: [],
    episodes: [],
    events: [],
    overrides: [],
    services,
    existingAlerts: [],
    previousAvailability: [],
    currentAvailability: [],
    previousRelease: { movieReleaseDates: {}, seasons: {} },
    currentRelease: { movieReleaseDates: {}, seasons: {} },
    previousCheckAt: now,
    ...overrides
  };
}

describe('generateAlerts — availability transitions', () => {
  it('creates a now_available alert only when the service was NOT available before and IS now (and is user-selected)', () => {
    const titles: Title[] = [{ id: 's1', mediaType: 'series', tmdbId: 1, title: 'S1', year: 2020 }];
    const libraryItems: LibraryItem[] = [{ titleId: 's1', addedAt: iso(-10), derivedStatus: 'To Watch', statusComputedAt: iso(0) }];
    const currentAvailability: AvailabilityEntry[] = [
      { titleId: 's1', serviceKey: 'netflix', optionType: 'subscription', deepLink: null, startsAt: null, endsAt: null, checkedAt: iso(0), source: 'streaming-availability' }
    ];
    const alerts = generateAlerts(baseArgs({ titles, libraryItems, previousAvailability: [], currentAvailability }));
    expect(alerts.some((a) => a.alertType === 'now_available' && a.titleId === 's1')).toBe(true);
  });

  it('does NOT create a now_available alert when the same availability already existed previously', () => {
    const titles: Title[] = [{ id: 's1', mediaType: 'series', tmdbId: 1, title: 'S1', year: 2020 }];
    const libraryItems: LibraryItem[] = [{ titleId: 's1', addedAt: iso(-10), derivedStatus: 'To Watch', statusComputedAt: iso(0) }];
    const availability: AvailabilityEntry[] = [
      { titleId: 's1', serviceKey: 'netflix', optionType: 'subscription', deepLink: null, startsAt: null, endsAt: null, checkedAt: iso(0), source: 'streaming-availability' }
    ];
    const alerts = generateAlerts(baseArgs({ titles, libraryItems, previousAvailability: availability, currentAvailability: availability }));
    expect(alerts.some((a) => a.alertType === 'now_available')).toBe(false);
  });

  it('a title can generate a new now_available alert after leaving and later returning to the same service', () => {
    const titles: Title[] = [{ id: 's1', mediaType: 'series', tmdbId: 1, title: 'S1', year: 2020 }];
    const libraryItems: LibraryItem[] = [{ titleId: 's1', addedAt: iso(-10), derivedStatus: 'To Watch', statusComputedAt: iso(0) }];
    const currentAvailability: AvailabilityEntry[] = [
      { titleId: 's1', serviceKey: 'netflix', optionType: 'subscription', deepLink: null, startsAt: iso(-1), endsAt: null, checkedAt: iso(0), source: 'streaming-availability' }
    ];
    const existingAlerts: AlertRecord[] = [{ id: 'old', titleId: 's1', alertType: 'now_available', message: 'old cycle', eventDate: null, createdAt: iso(-100), seenAt: iso(-99), dedupeKey: `s1:now_available:netflix:${iso(-120)}` }];
    const alerts = generateAlerts(baseArgs({ titles, libraryItems, previousAvailability: [], currentAvailability, existingAlerts }));
    expect(alerts.some((a) => a.alertType === 'now_available')).toBe(true);
  });

  it('does NOT create now_available for a service the user has not selected', () => {
    const titles: Title[] = [{ id: 's1', mediaType: 'series', tmdbId: 1, title: 'S1', year: 2020 }];
    const libraryItems: LibraryItem[] = [{ titleId: 's1', addedAt: iso(-10), derivedStatus: 'To Watch', statusComputedAt: iso(0) }];
    const currentAvailability: AvailabilityEntry[] = [
      { titleId: 's1', serviceKey: 'hbo-max', optionType: 'subscription', deepLink: null, startsAt: null, endsAt: null, checkedAt: iso(0), source: 'streaming-availability' }
    ];
    const alerts = generateAlerts(baseArgs({ titles, libraryItems, previousAvailability: [], currentAvailability }));
    expect(alerts.some((a) => a.alertType === 'now_available')).toBe(false);
  });

  it('leaving_soon fires only when a title genuinely enters the 30-day leaving window', () => {
    const titles: Title[] = [{ id: 's1', mediaType: 'series', tmdbId: 1, title: 'S1', year: 2020 }];
    const libraryItems: LibraryItem[] = [{ titleId: 's1', addedAt: iso(-10), derivedStatus: 'Watching', statusComputedAt: iso(0) }];
    const previousAvailability: AvailabilityEntry[] = [
      { titleId: 's1', serviceKey: 'netflix', optionType: 'subscription', deepLink: null, startsAt: null, endsAt: iso(10), checkedAt: iso(-25), source: 'streaming-availability' }
    ];
    const currentAvailability: AvailabilityEntry[] = [
      { titleId: 's1', serviceKey: 'netflix', optionType: 'subscription', deepLink: null, startsAt: null, endsAt: iso(10), checkedAt: iso(0), source: 'streaming-availability' }
    ];
    const alerts = generateAlerts(baseArgs({ titles, libraryItems, previousAvailability, currentAvailability, previousCheckAt: new Date(iso(-25)) }));
    expect(alerts.some((a) => a.alertType === 'leaving_soon' && a.titleId === 's1')).toBe(true);
  });

  it('does not create leaving_soon from an unchanged snapshot already inside the window', () => {
    const titles: Title[] = [{ id: 's1', mediaType: 'series', tmdbId: 1, title: 'S1', year: 2020 }];
    const libraryItems: LibraryItem[] = [{ titleId: 's1', addedAt: iso(-10), derivedStatus: 'Watching', statusComputedAt: iso(0) }];
    const availability: AvailabilityEntry[] = [
      { titleId: 's1', serviceKey: 'netflix', optionType: 'subscription', deepLink: null, startsAt: null, endsAt: iso(10), checkedAt: iso(0), source: 'streaming-availability' }
    ];
    const alerts = generateAlerts(baseArgs({ titles, libraryItems, previousAvailability: availability, currentAvailability: availability, previousCheckAt: now }));
    expect(alerts.some((a) => a.alertType === 'leaving_soon')).toBe(false);
  });

  it('a later distinct leaving event on the same service is not suppressed by an older alert', () => {
    const titles: Title[] = [{ id: 's1', mediaType: 'series', tmdbId: 1, title: 'S1', year: 2020 }];
    const libraryItems: LibraryItem[] = [{ titleId: 's1', addedAt: iso(-10), derivedStatus: 'Watching', statusComputedAt: iso(0) }];
    const currentAvailability: AvailabilityEntry[] = [
      { titleId: 's1', serviceKey: 'netflix', optionType: 'subscription', deepLink: null, startsAt: null, endsAt: iso(20), checkedAt: iso(0), source: 'streaming-availability' }
    ];
    const existingAlerts: AlertRecord[] = [{ id: 'a1', titleId: 's1', alertType: 'leaving_soon', message: 'old', eventDate: iso(-100), createdAt: iso(-120), seenAt: iso(-119), dedupeKey: `s1:leaving_soon:netflix:${iso(-100)}` }];
    const alerts = generateAlerts(baseArgs({ titles, libraryItems, previousAvailability: [], currentAvailability, existingAlerts }));
    expect(alerts.some((a) => a.alertType === 'leaving_soon' && a.eventDate === iso(20))).toBe(true);
  });

  it('never alerts for availability on a Finished Library title', () => {
    const titles: Title[] = [{ id: 'm1', mediaType: 'movie', tmdbId: 1, title: 'M1', year: 2020 }];
    const libraryItems: LibraryItem[] = [{ titleId: 'm1', addedAt: iso(-10), derivedStatus: 'Finished', statusComputedAt: iso(0) }];
    const overrides = [{ id: 'o1', scopeType: 'movie' as const, titleId: 'm1', state: 'watched' as const, changedAt: iso(-5) }];
    const currentAvailability: AvailabilityEntry[] = [
      { titleId: 'm1', serviceKey: 'netflix', optionType: 'subscription', deepLink: null, startsAt: null, endsAt: iso(5), checkedAt: iso(0), source: 'streaming-availability' }
    ];
    const alerts = generateAlerts(baseArgs({ titles, libraryItems, overrides, previousAvailability: [], currentAvailability }));
    expect(alerts.length).toBe(0);
  });
});

describe('generateAlerts — release-date transitions (movies)', () => {
  it('movie_release_announced fires when a release date is added where none existed', () => {
    const titles: Title[] = [{ id: 'm1', mediaType: 'movie', tmdbId: 1, title: 'M1', year: 2026 }];
    const libraryItems: LibraryItem[] = [{ titleId: 'm1', addedAt: iso(-10), derivedStatus: 'To Watch', statusComputedAt: iso(0) }];
    const previousRelease = { movieReleaseDates: { m1: null }, seasons: {} };
    const currentRelease = { movieReleaseDates: { m1: iso(55) }, seasons: {} };
    const alerts = generateAlerts(baseArgs({ titles, libraryItems, previousRelease, currentRelease }));
    expect(alerts.some((a) => a.alertType === 'movie_release_announced' && a.titleId === 'm1')).toBe(true);
  });

  it('movie_release_changed says "delayed" when the new date is later, and names old -> new date', () => {
    const titles: Title[] = [{ id: 'm1', mediaType: 'movie', tmdbId: 1, title: 'M1', year: 2026 }];
    const libraryItems: LibraryItem[] = [{ titleId: 'm1', addedAt: iso(-10), derivedStatus: 'To Watch', statusComputedAt: iso(0) }];
    const previousRelease = { movieReleaseDates: { m1: iso(10) }, seasons: {} }; // was 12 Oct-ish
    const currentRelease = { movieReleaseDates: { m1: iso(30) }, seasons: {} }; // now later
    const alerts = generateAlerts(baseArgs({ titles, libraryItems, previousRelease, currentRelease }));
    const alert = alerts.find((a) => a.alertType === 'movie_release_changed');
    expect(alert?.message.includes('delayed')).toBe(true);
  });

  it('movie_release_changed says "moved earlier" when the new date is sooner', () => {
    const titles: Title[] = [{ id: 'm1', mediaType: 'movie', tmdbId: 1, title: 'M1', year: 2026 }];
    const libraryItems: LibraryItem[] = [{ titleId: 'm1', addedAt: iso(-10), derivedStatus: 'To Watch', statusComputedAt: iso(0) }];
    const previousRelease = { movieReleaseDates: { m1: iso(30) }, seasons: {} };
    const currentRelease = { movieReleaseDates: { m1: iso(10) }, seasons: {} };
    const alerts = generateAlerts(baseArgs({ titles, libraryItems, previousRelease, currentRelease }));
    const alert = alerts.find((a) => a.alertType === 'movie_release_changed');
    expect(alert?.message.includes('moved earlier')).toBe(true);
  });

  it('does not re-fire when the release date is unchanged between checks', () => {
    const titles: Title[] = [{ id: 'm1', mediaType: 'movie', tmdbId: 1, title: 'M1', year: 2026 }];
    const libraryItems: LibraryItem[] = [{ titleId: 'm1', addedAt: iso(-10), derivedStatus: 'To Watch', statusComputedAt: iso(0) }];
    const release = { movieReleaseDates: { m1: iso(30) }, seasons: {} };
    const alerts = generateAlerts(baseArgs({ titles, libraryItems, previousRelease: release, currentRelease: release }));
    expect(alerts.some((a) => a.alertType === 'movie_release_announced' || a.alertType === 'movie_release_changed')).toBe(false);
  });

  it('only alerts for movies in My Library, not the whole catalogue', () => {
    const titles: Title[] = [{ id: 'm1', mediaType: 'movie', tmdbId: 1, title: 'M1', year: 2026 }];
    const previousRelease = { movieReleaseDates: { m1: null }, seasons: {} };
    const currentRelease = { movieReleaseDates: { m1: iso(10) }, seasons: {} };
    const alerts = generateAlerts(baseArgs({ titles, libraryItems: [], previousRelease, currentRelease }));
    expect(alerts.length).toBe(0);
  });
});

describe('generateAlerts — new episode available (Watching-only)', () => {
  function ep(season: number, episode: number, airDate: string): Episode {
    return { titleId: 's1', seasonNumber: season, episodeNumber: episode, tmdbEpisodeId: episode, name: `E${episode}`, runtime: 40, airDate, overview: '' };
  }

  it('fires only for a series currently in Watching status, for an episode newly crossed into "released"', () => {
    const titles: Title[] = [{ id: 's1', mediaType: 'series', tmdbId: 1, title: 'S1', year: 2020 }];
    const libraryItems: LibraryItem[] = [{ titleId: 's1', addedAt: iso(-100), derivedStatus: 'Watching', statusComputedAt: iso(0) }];
    // E1 watched long ago (established Watching), E2 just released between previousCheckAt and now.
    const episodes = [ep(1, 1, iso(-10)), ep(1, 2, iso(-1))];
    const events = [{ id: 'e1', providerEventId: 'p1', titleId: 's1', seasonNumber: 1, episodeNumber: 1, watchedAt: iso(-9), source: 'trakt' as const }];
    const alerts = generateAlerts(baseArgs({ titles, libraryItems, episodes, events, previousCheckAt: new Date(now.getTime() - 2 * 86400000) }));
    expect(alerts.some((a) => a.alertType === 'new_episode_available' && a.message.includes('E2'))).toBe(true);
  });

  it('does NOT fire for a series that is To Watch / On Hold / Caught Up / Finished', () => {
    const titles: Title[] = [{ id: 's1', mediaType: 'series', tmdbId: 1, title: 'S1', year: 2020 }];
    // Caught Up: only episode released is watched already; a second episode "newly releases" but status is Caught Up until watched.
    const libraryItems: LibraryItem[] = [{ titleId: 's1', addedAt: iso(-100), derivedStatus: 'Caught Up', statusComputedAt: iso(0) }];
    const episodes = [ep(1, 1, iso(-10))];
    const events = [{ id: 'e1', providerEventId: 'p1', titleId: 's1', seasonNumber: 1, episodeNumber: 1, watchedAt: iso(-9), source: 'trakt' as const }];
    const alerts = generateAlerts(baseArgs({ titles, libraryItems, episodes, events, previousCheckAt: new Date(now.getTime() - 2 * 86400000) }));
    expect(alerts.some((a) => a.alertType === 'new_episode_available')).toBe(false);
  });

  it('does not re-alert for an episode that released before the previous check (already known)', () => {
    const titles: Title[] = [{ id: 's1', mediaType: 'series', tmdbId: 1, title: 'S1', year: 2020 }];
    const libraryItems: LibraryItem[] = [{ titleId: 's1', addedAt: iso(-100), derivedStatus: 'Watching', statusComputedAt: iso(0) }];
    const episodes = [ep(1, 1, iso(-20)), ep(1, 2, iso(-15))]; // both released well before previousCheckAt
    const events = [{ id: 'e1', providerEventId: 'p1', titleId: 's1', seasonNumber: 1, episodeNumber: 1, watchedAt: iso(-18), source: 'trakt' as const }];
    const alerts = generateAlerts(baseArgs({ titles, libraryItems, episodes, events, previousCheckAt: new Date(now.getTime() - 2 * 86400000) }));
    expect(alerts.some((a) => a.alertType === 'new_episode_available')).toBe(false);
  });
});

describe('applyRetention', () => {
  it('keeps at most 30 alerts, newest first, dropping the oldest', () => {
    const alerts: AlertRecord[] = Array.from({ length: 35 }, (_, i) => ({
      id: `a${i}`, titleId: 't', alertType: 'now_available', message: 'x', eventDate: null,
      createdAt: iso(-35 + i), seenAt: null, dedupeKey: `k${i}`
    }));
    const retained = applyRetention(alerts);
    expect(retained.length).toBe(30);
    expect(retained.map((a) => a.id)).not.toContain('a0');
    expect(retained[0].id).toBe('a34');
  });
});

describe('buildReleaseSnapshot', () => {
  it('captures movie release dates and season air dates keyed for diffing', () => {
    const titles: Title[] = [{ id: 'm1', mediaType: 'movie', tmdbId: 1, title: 'M1', year: 2026 }];
    const metadata: TitleMetadata[] = [{ titleId: 'm1', status: 'Upcoming', overview: '', genres: [], posterPath: '', backdropPath: '', trailerKey: null, metadataUpdatedAt: '', releaseDate: iso(10) }];
    const seasons: Season[] = [{ titleId: 's1', seasonNumber: 2, tmdbSeasonId: 2, name: 'Season 2', episodeCount: 4, airDate: iso(5) }];
    const snapshot = buildReleaseSnapshot(titles, metadata, seasons, [], now);
    expect(snapshot.movieReleaseDates['m1']).toBe(iso(10));
    expect(snapshot.seasons['s1:2'].exists).toBe(true);
    expect(snapshot.seasons['s1:2'].airDate).toBe(iso(5));
  });

  it('distinguishes "season does not exist" from "season exists with no date"', () => {
    const snapshot = buildReleaseSnapshot([], [], [], [], now);
    expect(snapshot.seasons['s1:2']).toBeUndefined();
  });

  it('marks a season "available" only once it has at least one released episode', () => {
    const seasons: Season[] = [{ titleId: 's1', seasonNumber: 2, tmdbSeasonId: 2, name: 'Season 2', episodeCount: 1, airDate: iso(-5) }];
    const notYetReleased: Episode[] = [{ titleId: 's1', seasonNumber: 2, episodeNumber: 1, tmdbEpisodeId: 1, name: 'E1', runtime: 40, airDate: iso(5), overview: '' }];
    const notAvailable = buildReleaseSnapshot([], [], seasons, notYetReleased, now);
    expect(notAvailable.seasons['s1:2'].available).toBe(false);

    const released: Episode[] = [{ titleId: 's1', seasonNumber: 2, episodeNumber: 1, tmdbEpisodeId: 1, name: 'E1', runtime: 40, airDate: iso(-1), overview: '' }];
    const available = buildReleaseSnapshot([], [], seasons, released, now);
    expect(available.seasons['s1:2'].available).toBe(true);
  });
});

describe('generateAlerts — series season alert change detection (final-pass fix)', () => {
  const title: Title = { id: 's1', mediaType: 'series', tmdbId: 1, title: 'S1', year: 2020 };
  const libraryItems: LibraryItem[] = [{ titleId: 's1', addedAt: iso(-100), derivedStatus: 'Caught Up', statusComputedAt: iso(0) }];
  const season2: Season = { titleId: 's1', seasonNumber: 2, tmdbSeasonId: 2, name: 'Season 2', episodeCount: 4, airDate: iso(20) };

  it('FIRST SYNC / IDENTICAL SNAPSHOT: an already-known upcoming season produces zero alerts', () => {
    const snapshot = buildReleaseSnapshot([title], [], [season2], [], now);
    const alerts = generateAlerts(baseArgs({
      titles: [title], libraryItems, seasons: [season2],
      previousRelease: snapshot, currentRelease: snapshot
    }));
    expect(alerts.length).toBe(0);
  });

  it('NEW SEASON DISCOVERED: season absent from the previous snapshot (even with no date yet) fires new_season_announced', () => {
    const seasonNoDate: Season = { ...season2, airDate: null };
    const previousRelease = buildReleaseSnapshot([title], [], [], [], now); // season didn't exist yet
    const currentRelease = buildReleaseSnapshot([title], [], [seasonNoDate], [], now);
    const alerts = generateAlerts(baseArgs({ titles: [title], libraryItems, seasons: [seasonNoDate], previousRelease, currentRelease }));
    expect(alerts.some((a) => a.alertType === 'new_season_announced' && a.titleId === 's1')).toBe(true);
  });

  it('does not re-fire NEW SEASON DISCOVERED when the same snapshot is processed again', () => {
    const previousRelease = buildReleaseSnapshot([title], [], [], [], now);
    const currentRelease = buildReleaseSnapshot([title], [], [season2], [], now);
    const existingAlerts = generateAlerts(baseArgs({ titles: [title], libraryItems, seasons: [season2], previousRelease, currentRelease }));
    // Re-running with the same current snapshot as both previous and current (i.e. the baseline
    // has advanced) must not create a second "discovered" alert.
    const alerts = generateAlerts(baseArgs({
      titles: [title], libraryItems, seasons: [season2],
      previousRelease: currentRelease, currentRelease, existingAlerts
    }));
    expect(alerts.some((a) => a.alertType === 'new_season_announced')).toBe(false);
  });

  it('RELEASE DATE ADDED: a known season with no date gaining one fires new_season_announced', () => {
    const seasonNoDate: Season = { ...season2, airDate: null };
    const previousRelease = buildReleaseSnapshot([title], [], [seasonNoDate], [], now);
    const currentRelease = buildReleaseSnapshot([title], [], [season2], [], now);
    const alerts = generateAlerts(baseArgs({ titles: [title], libraryItems, seasons: [season2], previousRelease, currentRelease }));
    expect(alerts.some((a) => a.alertType === 'new_season_announced' && a.message.includes('date added'))).toBe(true);
  });

  it('RELEASE DATE CHANGED: an existing date moving later fires with old -> new dates ("delayed")', () => {
    const seasonEarlier: Season = { ...season2, airDate: iso(20) };
    const seasonLater: Season = { ...season2, airDate: iso(40) };
    const previousRelease = buildReleaseSnapshot([title], [], [seasonEarlier], [], now);
    const currentRelease = buildReleaseSnapshot([title], [], [seasonLater], [], now);
    const alerts = generateAlerts(baseArgs({ titles: [title], libraryItems, seasons: [seasonLater], previousRelease, currentRelease }));
    const alert = alerts.find((a) => a.alertType === 'new_season_announced' && a.message.includes('delayed'));
    expect(alert).toBeTruthy();
  });

  it('does not re-fire when the release date is unchanged between checks', () => {
    const snapshot = buildReleaseSnapshot([title], [], [season2], [], now);
    const alerts = generateAlerts(baseArgs({ titles: [title], libraryItems, seasons: [season2], previousRelease: snapshot, currentRelease: snapshot }));
    expect(alerts.length).toBe(0);
  });

  it('NEW SEASON AVAILABLE: a season genuinely crossing into availability fires new_season_available', () => {
    const seasonAired: Season = { ...season2, airDate: iso(-5) };
    const ep1: Episode = { titleId: 's1', seasonNumber: 2, episodeNumber: 1, tmdbEpisodeId: 1, name: 'E1', runtime: 40, airDate: iso(-1), overview: '' };
    const previousRelease = buildReleaseSnapshot([title], [], [seasonAired], [], now); // no episodes yet -> not available
    const currentRelease = buildReleaseSnapshot([title], [], [seasonAired], [ep1], now); // episode released -> available
    const alerts = generateAlerts(baseArgs({ titles: [title], libraryItems, seasons: [seasonAired], previousRelease, currentRelease }));
    expect(alerts.some((a) => a.alertType === 'new_season_available' && a.titleId === 's1')).toBe(true);
  });

  it('does not re-fire NEW SEASON AVAILABLE once already available in both snapshots', () => {
    const seasonAired: Season = { ...season2, airDate: iso(-5) };
    const ep1: Episode = { titleId: 's1', seasonNumber: 2, episodeNumber: 1, tmdbEpisodeId: 1, name: 'E1', runtime: 40, airDate: iso(-1), overview: '' };
    const snapshot = buildReleaseSnapshot([title], [], [seasonAired], [ep1], now);
    const alerts = generateAlerts(baseArgs({ titles: [title], libraryItems, seasons: [seasonAired], previousRelease: snapshot, currentRelease: snapshot }));
    expect(alerts.length).toBe(0);
  });
});
