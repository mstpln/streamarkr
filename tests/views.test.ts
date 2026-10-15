import { describe, it } from 'node:test';
import { expect } from './expect-shim.js';
import { watchingNow, rateNow, newMovieReleases, resolveRateNowMedia, type Snapshot } from '../src/lib/views.js';
import type { Episode, LibraryItem, Title, TitleMetadata, WatchEvent, WatchOverride } from '../src/lib/types.js';

const now = new Date();
const isoDaysAgo = (days: number) => new Date(now.getTime() - days * 86400000).toISOString();

function series(id: string, title: string): Title {
  return { id, mediaType: 'series', tmdbId: Number(id.replace(/\D/g, '')) || 1, title, year: 2024 };
}
function movie(id: string, title: string): Title {
  return { id, mediaType: 'movie', tmdbId: Number(id.replace(/\D/g, '')) || 1, title, year: 2026 };
}
function movieMetadata(titleId: string, releaseDate: string | null): TitleMetadata {
  return { titleId, status: releaseDate && releaseDate > '2026-10-15' ? 'Upcoming' : 'Released', overview: '', genres: [], posterPath: '', backdropPath: '', trailerKey: null, metadataUpdatedAt: '', releaseDate };
}
function ep(titleId: string, n: number): Episode {
  return { titleId, seasonNumber: 1, episodeNumber: n, tmdbEpisodeId: n, name: `E${n}`, runtime: 40, airDate: isoDaysAgo(30 - n), overview: '' };
}
function event(titleId: string, episodeNumber: number, daysAgo: number): WatchEvent {
  return { id: `${titleId}-${episodeNumber}`, providerEventId: `p-${titleId}-${episodeNumber}`, titleId, seasonNumber: 1, episodeNumber, watchedAt: isoDaysAgo(daysAgo), source: 'trakt' };
}

function snapshot(overrides: Partial<Snapshot>): Snapshot {
  return {
    titles: [], metadata: [], seasons: [], episodes: [], events: [], overrides: [], library: [], ratings: [], watchedService: [], services: [], availability: [], alerts: [],
    ...overrides
  };
}

describe('Home read models', () => {
  it('Watching Now sorts by real watched timestamps, not a newer manual correction timestamp', () => {
    const a = series('s1', 'Older correction');
    const b = series('s2', 'Actually watched most recently');
    const episodes = [ep('s1', 1), ep('s1', 2), ep('s2', 1), ep('s2', 2)];
    const events = [event('s1', 1, 5), event('s2', 1, 1)];
    const manual: WatchOverride[] = [{ id: 'manual', scopeType: 'episode', titleId: 's1', seasonNumber: 1, episodeNumber: 2, state: 'unwatched', changedAt: isoDaysAgo(0) }];
    const library: LibraryItem[] = [a, b].map((t) => ({ titleId: t.id, addedAt: isoDaysAgo(50), derivedStatus: 'Watching', statusComputedAt: isoDaysAgo(0) }));
    const rows = watchingNow(snapshot({ titles: [a, b], episodes, events, overrides: manual, library }));
    expect(rows[0].title.id).toBe('s2');
  });

  it('Rate Now automatically switches to the media type that still has items instead of hiding the section', () => {
    expect(resolveRateNowMedia('series', 0, 2)).toBe('movie');
    expect(resolveRateNowMedia('movie', 3, 0)).toBe('series');
    expect(resolveRateNowMedia('series', 1, 2)).toBe('series');
  });

  it('Rate Now remains independently available for movies and series', () => {
    const s = series('s3', 'Rated later');
    const movie: Title = { id: 'm1', mediaType: 'movie', tmdbId: 99, title: 'Movie', year: 2026 };
    const episodes = [ep('s3', 1)];
    const events: WatchEvent[] = [event('s3', 1, 1), { id: 'm', providerEventId: 'pm', titleId: 'm1', watchedAt: isoDaysAgo(2), source: 'trakt' }];
    const library: LibraryItem[] = [s, movie].map((t) => ({ titleId: t.id, addedAt: isoDaysAgo(10), derivedStatus: 'To Watch', statusComputedAt: isoDaysAgo(0) }));
    const snap = snapshot({ titles: [s, movie], episodes, events, library });
    expect(rateNow(snap, 'series').length).toBe(1);
    expect(rateNow(snap, 'movie').length).toBe(1);
  });

  it('shows upcoming and recent release dates for unwatched movies in My Library only', () => {
    const soon = movie('movie-1', 'Soon');
    const later = movie('movie-2', 'Later');
    const recent = movie('movie-3', 'Recent');
    const old = movie('movie-4', 'Old');
    const watched = movie('movie-5', 'Watched');
    const catalogOnly = movie('movie-6', 'Catalog only');
    const notMovie = series('series-7', 'Series');
    const library: LibraryItem[] = [soon, later, recent, old, watched, notMovie].map((title) => ({
      titleId: title.id, addedAt: isoDaysAgo(10), derivedStatus: 'To Watch', statusComputedAt: isoDaysAgo(0)
    }));
    const snap = snapshot({
      titles: [soon, later, recent, old, watched, catalogOnly, notMovie],
      metadata: [
        movieMetadata(soon.id, '2026-10-19'),
        movieMetadata(later.id, '2026-12-01'),
        movieMetadata(recent.id, '2026-10-10'),
        movieMetadata(old.id, '2026-09-01'),
        movieMetadata(watched.id, '2026-10-12'),
        movieMetadata(catalogOnly.id, '2026-10-20')
      ],
      library,
      events: [{ id: 'watched-event', providerEventId: 'watched-event', titleId: watched.id, watchedAt: isoDaysAgo(2), source: 'trakt' }]
    });

    const releases = newMovieReleases(snap, new Date('2026-10-15T12:00:00.000Z'));
    expect(releases.map((release) => release.title.id).join(',')).toBe('movie-1,movie-2,movie-3');
    expect(releases.map((release) => release.releaseState).join(',')).toBe('upcoming,upcoming,released');
  });
});
