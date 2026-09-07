import { describe, it } from 'node:test';
import { expect } from './expect-shim.js';
import { buildHistoryRow, sortRecentlyWatched } from '../src/lib/history.js';
import type { Episode, Title, WatchEvent, WatchOverride } from '../src/lib/types.js';

const now = new Date('2026-09-05T12:00:00Z');
const iso = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86400000).toISOString();

const seriesTitle: Title = { id: 's1', mediaType: 'series', tmdbId: 1, title: 'Series One', year: 2020 };
const movieTitle: Title = { id: 'm1', mediaType: 'movie', tmdbId: 2, title: 'Movie One', year: 2020 };

function ep(season: number, episode: number, daysAgo: number): Episode {
  return { titleId: 's1', seasonNumber: season, episodeNumber: episode, tmdbEpisodeId: episode, name: `E${episode}`, runtime: 40, airDate: iso(daysAgo), overview: '' };
}
function we(titleId: string, season: number | undefined, episode: number | undefined, daysAgo: number): WatchEvent {
  return { id: `${titleId}-${season}-${episode}`, providerEventId: 'p', titleId, seasonNumber: season, episodeNumber: episode, watchedAt: iso(daysAgo), source: 'trakt' };
}

describe('buildHistoryRow', () => {
  it('is null (excluded from History) when nothing has been watched', () => {
    const episodes = [ep(1, 1, 5)];
    expect(buildHistoryRow(seriesTitle, episodes, [], [], now)).toBeNull();
  });

  it('aggregates one row per series with watched/total released counts', () => {
    const episodes = [ep(1, 1, 10), ep(1, 2, 5)];
    const events = [we('s1', 1, 1, 10)];
    const row = buildHistoryRow(seriesTitle, episodes, events, [], now);
    expect(row).toMatchObject({ watchedReleasedCount: 1, totalReleasedCount: 2, mediaType: 'series' });
  });

  it('includes a manually-watched movie with no real date, and does not fabricate one', () => {
    const overrides: WatchOverride[] = [{ id: 'ov', scopeType: 'movie', titleId: 'm1', state: 'watched', changedAt: iso(50) }];
    const row = buildHistoryRow(movieTitle, [], [], overrides, now);
    expect(row?.hasAnyWatched).toBe(true);
    expect(row?.lastWatchedAt).toBeNull();
  });
});

describe('sortRecentlyWatched', () => {
  it('sorts known dates before unknown dates, and unknown dates alphabetically after', () => {
    const rows = [
      { titleName: 'Zebra', lastWatchedAt: null },
      { titleName: 'Alpha Known', lastWatchedAt: iso(1) },
      { titleName: 'Beta Known', lastWatchedAt: iso(10) },
      { titleName: 'Apple Unknown', lastWatchedAt: null }
    ];
    const sorted = sortRecentlyWatched(rows);
    expect(sorted.map((r) => r.titleName)).toEqual(['Alpha Known', 'Beta Known', 'Apple Unknown', 'Zebra']);
  });
});
