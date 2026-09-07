import { describe, it } from 'node:test';
import { expect } from './expect-shim.js';
import { computeRelevantSeason, engagedSeasonNumber, seasonProgress } from '../src/lib/season-select.js';
import type { Episode, WatchEvent } from '../src/lib/types.js';

const now = new Date('2026-09-05T12:00:00Z');
const iso = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86400000).toISOString();

function ep(season: number, episode: number, airDaysAgo: number): Episode {
  return { titleId: 't1', seasonNumber: season, episodeNumber: episode, tmdbEpisodeId: season * 100 + episode, name: `E${episode}`, runtime: 40, airDate: iso(airDaysAgo), overview: '' };
}
function watched(season: number, episode: number, daysAgo: number): WatchEvent {
  return { id: `${season}-${episode}`, providerEventId: `p-${season}-${episode}`, titleId: 't1', seasonNumber: season, episodeNumber: episode, watchedAt: iso(daysAgo), source: 'trakt' };
}

describe('computeRelevantSeason (Correction 10)', () => {
  it('CORRECTION 10: stays on the season actively being watched, even if a newer season also has unwatched episodes', () => {
    // User is midway through S2 (E1 watched, E2 not). S3 has just released, untouched.
    const seasons = [{ seasonNumber: 1 }, { seasonNumber: 2 }, { seasonNumber: 3 }];
    const episodes = [ep(1, 1, 100), ep(2, 1, 10), ep(2, 2, 5), ep(3, 1, 2)];
    const events = [watched(1, 1, 90), watched(2, 1, 4)];
    const season = computeRelevantSeason('t1', seasons, episodes, events, [], now);
    expect(season).toBe(2);
  });

  it('falls back to the latest season with released-unwatched episodes when nothing is actively in progress', () => {
    const seasons = [{ seasonNumber: 1 }, { seasonNumber: 2 }];
    const episodes = [ep(1, 1, 100), ep(1, 2, 90), ep(2, 1, 10)]; // S1 fully watched, S2 untouched
    const events = [watched(1, 1, 95), watched(1, 2, 85)];
    const season = computeRelevantSeason('t1', seasons, episodes, events, [], now);
    expect(season).toBe(2);
  });

  it('falls back to the latest released season when nothing has been watched at all', () => {
    const seasons = [{ seasonNumber: 1 }, { seasonNumber: 2 }];
    const episodes = [ep(1, 1, 100), ep(2, 1, 10)];
    const season = computeRelevantSeason('t1', seasons, episodes, [], [], now);
    expect(season).toBe(2);
  });
});

describe('engagedSeasonNumber', () => {
  it('is null when nothing has been watched', () => {
    expect(engagedSeasonNumber('t1', [ep(1, 1, 10)], [], [], now)).toBeNull();
  });
  it('is the highest season with at least one watched episode', () => {
    const episodes = [ep(1, 1, 100), ep(2, 1, 10)];
    const events = [watched(1, 1, 90)];
    expect(engagedSeasonNumber('t1', episodes, events, [], now)).toBe(1);
  });
});

describe('seasonProgress', () => {
  it('counts only released episodes and respects overrides', () => {
    const episodes = [ep(1, 1, 10), ep(1, 2, 5), ep(1, 3, -5)]; // E3 not released yet
    const events = [watched(1, 1, 8)];
    const overrides = [{ id: 'o1', scopeType: 'episode' as const, titleId: 't1', seasonNumber: 1, episodeNumber: 2, state: 'watched' as const, changedAt: iso(1) }];
    const progress = seasonProgress('t1', 1, episodes, events, overrides, now);
    expect(progress).toEqual({ watched: 2, total: 2 });
  });
});
