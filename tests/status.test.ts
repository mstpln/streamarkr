import { describe, it } from 'node:test';
import { expect } from './expect-shim.js';
import { computeSeriesStatus, computeNewSeasonEntry } from '../src/lib/status.js';
import type { Episode, WatchEvent, WatchOverride } from '../src/lib/types.js';

const DAY = 86400000;
const now = new Date('2026-09-05T12:00:00Z');
const iso = (daysFromNow: number) => new Date(now.getTime() + daysFromNow * DAY).toISOString();

function ep(season: number, episode: number, airDaysAgo: number | null): Episode {
  return {
    titleId: 't1', seasonNumber: season, episodeNumber: episode, tmdbEpisodeId: season * 100 + episode,
    name: `E${episode}`, runtime: 40, airDate: airDaysAgo === null ? null : iso(-airDaysAgo), overview: ''
  };
}
function watched(season: number, episode: number, daysAgo: number): WatchEvent {
  return { id: `${season}-${episode}`, providerEventId: `p-${season}-${episode}`, titleId: 't1', seasonNumber: season, episodeNumber: episode, watchedAt: iso(-daysAgo), source: 'trakt' };
}

describe('computeSeriesStatus', () => {
  it('is To Watch when nothing released has been watched', () => {
    const episodes = [ep(1, 1, 5), ep(1, 2, 2)];
    const status = computeSeriesStatus({ titleId: 't1', episodes, metadataStatus: 'Returning Series', events: [], overrides: [], now });
    expect(status).toBe('To Watch');
  });

  it('is To Watch when nothing has released yet', () => {
    const episodes = [ep(1, 1, null)];
    const status = computeSeriesStatus({ titleId: 't1', episodes, metadataStatus: 'Returning Series', events: [], overrides: [], now });
    expect(status).toBe('To Watch');
  });

  it('is Watching when partially watched with recent activity', () => {
    const episodes = [ep(1, 1, 10), ep(1, 2, 5)];
    const events = [watched(1, 1, 2)];
    const status = computeSeriesStatus({ titleId: 't1', episodes, metadataStatus: 'Returning Series', events, overrides: [], now });
    expect(status).toBe('Watching');
  });

  it('is On Hold when released-unwatched episodes exist and no activity for >=14 days', () => {
    const episodes = [ep(1, 1, 30), ep(1, 2, 20)];
    const events = [watched(1, 1, 20)]; // last activity 20 days ago
    const status = computeSeriesStatus({ titleId: 't1', episodes, metadataStatus: 'Returning Series', events, overrides: [], now });
    expect(status).toBe('On Hold');
  });

  it('never marks a Caught Up series (no released-unwatched episodes) as On Hold', () => {
    const episodes = [ep(1, 1, 30), ep(1, 2, 20)];
    const events = [watched(1, 1, 30), watched(1, 2, 20)]; // fully watched, last activity 20 days ago
    const status = computeSeriesStatus({ titleId: 't1', episodes, metadataStatus: 'Returning Series', events, overrides: [], now });
    expect(status).toBe('Caught Up');
  });

  it('is Finished when fully watched and TMDB reports Ended', () => {
    const episodes = [ep(1, 1, 30)];
    const events = [watched(1, 1, 10)];
    const status = computeSeriesStatus({ titleId: 't1', episodes, metadataStatus: 'Ended', events, overrides: [], now });
    expect(status).toBe('Finished');
  });

  it('CORRECTION 2 regression: a new season releasing with zero watched episodes keeps a Caught Up series Caught Up', () => {
    // S1 fully watched and watched long ago; S2 just released with 3 episodes, none watched yet.
    const episodes = [ep(1, 1, 100), ep(1, 2, 90), ep(2, 1, 2), ep(2, 2, 1)];
    const events = [watched(1, 1, 95), watched(1, 2, 85)];
    const status = computeSeriesStatus({ titleId: 't1', episodes, metadataStatus: 'Returning Series', events, overrides: [], now });
    expect(status).toBe('Caught Up');
  });

  it('CORRECTION 2 regression: watching the first episode of the new season moves it to Watching', () => {
    const episodes = [ep(1, 1, 100), ep(1, 2, 90), ep(2, 1, 2), ep(2, 2, 1)];
    const events = [watched(1, 1, 95), watched(1, 2, 85), watched(2, 1, 1)];
    const status = computeSeriesStatus({ titleId: 't1', episodes, metadataStatus: 'Returning Series', events, overrides: [], now });
    expect(status).toBe('Watching');
  });

  it('CORRECTION 2 regression: a new season sitting unwatched for 20+ days does not become On Hold on its own', () => {
    const episodes = [ep(1, 1, 100), ep(1, 2, 90), ep(2, 1, 25), ep(2, 2, 20)];
    const events = [watched(1, 1, 95), watched(1, 2, 85)]; // last real activity 85 days ago
    const status = computeSeriesStatus({ titleId: 't1', episodes, metadataStatus: 'Returning Series', events, overrides: [], now });
    expect(status).toBe('Caught Up');
  });

  it('manual override precedence: unwatched override beats a provider watch event', () => {
    const episodes = [ep(1, 1, 30), ep(1, 2, 20)];
    const events = [watched(1, 1, 1), watched(1, 2, 1)]; // both provider events are recent
    const overrides: WatchOverride[] = [{ id: 'ov1', scopeType: 'episode', titleId: 't1', seasonNumber: 1, episodeNumber: 2, state: 'unwatched', changedAt: iso(-1) }];
    const status = computeSeriesStatus({ titleId: 't1', episodes, metadataStatus: 'Returning Series', events, overrides, now });
    // E2 is forced unwatched by the override despite a provider event saying it was watched, and
    // recent real (event-based) activity keeps this Watching rather than On Hold.
    expect(status).toBe('Watching');
  });

  describe('final-pass fix: Caught Up requires ALL released episodes watched, not just the engaged season', () => {
    it('older-season gap + fully-watched newer season => NOT Caught Up (Watching)', () => {
      // S1: E1 watched, E2 unwatched. S2: E1 watched, E2 watched (recent activity).
      const episodes = [ep(1, 1, 30), ep(1, 2, 29), ep(2, 1, 10), ep(2, 2, 9)];
      const events = [watched(1, 1, 25), watched(2, 1, 5), watched(2, 2, 1)];
      const status = computeSeriesStatus({ titleId: 't1', episodes, metadataStatus: 'Returning Series', events, overrides: [], now });
      expect(status).toBe('Watching');
    });

    it('fully watched through Season 2 + an untouched newly released Season 3 => still Caught Up', () => {
      const episodes = [ep(1, 1, 40), ep(1, 2, 39), ep(2, 1, 20), ep(2, 2, 19), ep(3, 1, 2), ep(3, 2, 1)];
      const events = [watched(1, 1, 35), watched(1, 2, 34), watched(2, 1, 15), watched(2, 2, 14)];
      const status = computeSeriesStatus({ titleId: 't1', episodes, metadataStatus: 'Returning Series', events, overrides: [], now });
      expect(status).toBe('Caught Up');
    });

    it('after watching S3E1, Watching (released-unwatched S3E2 remains) rather than Caught Up', () => {
      const episodes = [ep(1, 1, 40), ep(1, 2, 39), ep(2, 1, 20), ep(2, 2, 19), ep(3, 1, 2), ep(3, 2, 1)];
      const events = [watched(1, 1, 35), watched(1, 2, 34), watched(2, 1, 15), watched(2, 2, 14), watched(3, 1, 1)];
      const status = computeSeriesStatus({ titleId: 't1', episodes, metadataStatus: 'Returning Series', events, overrides: [], now });
      expect(status).toBe('Watching');
    });

    it('every released episode watched => Caught Up', () => {
      const episodes = [ep(1, 1, 10), ep(1, 2, 9)];
      const events = [watched(1, 1, 5), watched(1, 2, 4)];
      const status = computeSeriesStatus({ titleId: 't1', episodes, metadataStatus: 'Returning Series', events, overrides: [], now });
      expect(status).toBe('Caught Up');
    });

    it('every released episode watched + series Ended => Finished', () => {
      const episodes = [ep(1, 1, 10), ep(1, 2, 9)];
      const events = [watched(1, 1, 5), watched(1, 2, 4)];
      const status = computeSeriesStatus({ titleId: 't1', episodes, metadataStatus: 'Ended', events, overrides: [], now });
      expect(status).toBe('Finished');
    });
  });

  describe('final-pass fix: On Hold uses real watching activity, not override changedAt', () => {
    it('a manual correction made today does NOT fabricate recent viewing activity for the On Hold timer', () => {
      // Only real watch event is 20 days old; a manual override touched today marks E2 unwatched
      // again. The correction's changedAt must not be read as "watched 0 days ago".
      const episodes = [ep(1, 1, 25), ep(1, 2, 20)];
      const events = [watched(1, 1, 20), watched(1, 2, 20)];
      const overrides: WatchOverride[] = [{ id: 'ov1', scopeType: 'episode', titleId: 't1', seasonNumber: 1, episodeNumber: 2, state: 'unwatched', changedAt: iso(0) }];
      const status = computeSeriesStatus({ titleId: 't1', episodes, metadataStatus: 'Returning Series', events, overrides, now });
      expect(status).toBe('On Hold');
    });

    it('with only manual watch state and no genuine provider timestamp, stays Watching rather than inventing a date', () => {
      const episodes = [ep(1, 1, 25), ep(1, 2, 20)];
      const overrides: WatchOverride[] = [
        { id: 'ov1', scopeType: 'episode', titleId: 't1', seasonNumber: 1, episodeNumber: 1, state: 'watched', changedAt: iso(-30) }
      ];
      const status = computeSeriesStatus({ titleId: 't1', episodes, metadataStatus: 'Returning Series', events: [], overrides, now });
      expect(status).toBe('Watching');
    });

    it('recent real provider activity keeps status Watching, not On Hold', () => {
      const episodes = [ep(1, 1, 25), ep(1, 2, 20)];
      const events = [watched(1, 1, 2)];
      const status = computeSeriesStatus({ titleId: 't1', episodes, metadataStatus: 'Returning Series', events, overrides: [], now });
      expect(status).toBe('Watching');
    });
  });
});

describe('computeNewSeasonEntry', () => {
  it('shows an upcoming season before release', () => {
    const seasons = [{ titleId: 't1', seasonNumber: 2, tmdbSeasonId: 2, name: 'Season 2', episodeCount: 4, airDate: iso(20) }];
    const episodes = [ep(2, 1, null)];
    episodes[0].airDate = iso(20);
    const entry = computeNewSeasonEntry('t1', seasons, episodes, [], [], now);
    expect(entry?.releaseState).toBe('upcoming');
  });

  it('drops the New Season card once the season is fully watched', () => {
    const seasons = [{ titleId: 't1', seasonNumber: 2, tmdbSeasonId: 2, name: 'Season 2', episodeCount: 1, airDate: iso(-5) }];
    const episodes = [{ ...ep(2, 1, 5) }];
    const events = [watched(2, 1, 3)];
    const entry = computeNewSeasonEntry('t1', seasons, episodes, events, [], now);
    expect(entry).toBeNull();
  });

  it('expires 14 days after the season finale airs if not finished', () => {
    const seasons = [{ titleId: 't1', seasonNumber: 2, tmdbSeasonId: 2, name: 'Season 2', episodeCount: 1, airDate: iso(-20) }];
    const episodes = [ep(2, 1, 20)];
    const entry = computeNewSeasonEntry('t1', seasons, episodes, [], [], now);
    expect(entry).toBeNull();
  });

  it('ignores season 1 as a "new season" event', () => {
    const seasons = [{ titleId: 't1', seasonNumber: 1, tmdbSeasonId: 1, name: 'Season 1', episodeCount: 1, airDate: iso(5) }];
    const episodes = [ep(1, 1, null)];
    episodes[0].airDate = iso(5);
    const entry = computeNewSeasonEntry('t1', seasons, episodes, [], [], now);
    expect(entry).toBeNull();
  });

  it('shows a provider-known future season even before episode records exist', () => {
    const seasons = [{ titleId: 't1', seasonNumber: 2, tmdbSeasonId: 2, name: 'Season 2', episodeCount: 8, airDate: iso(25) }];
    const entry = computeNewSeasonEntry('t1', seasons, [], [], [], now);
    expect(entry?.releaseState).toBe('upcoming');
    expect(entry?.firstAirDate).toBe(iso(25));
  });

  it('shows a provider-known dateless future season as upcoming / date TBA', () => {
    const seasons = [{ titleId: 't1', seasonNumber: 3, tmdbSeasonId: 3, name: 'Season 3', episodeCount: 0, airDate: null }];
    const entry = computeNewSeasonEntry('t1', seasons, [], [], [], now);
    expect(entry?.releaseState).toBe('upcoming');
    expect(entry?.firstAirDate).toBeNull();
  });

  it('retains a started season without episode records for 14 days after its known start date', () => {
    const seasons = [{ titleId: 't1', seasonNumber: 2, tmdbSeasonId: 2, name: 'Season 2', episodeCount: 8, airDate: iso(-5) }];
    const entry = computeNewSeasonEntry('t1', seasons, [], [], [], now);
    expect(entry?.releaseState).toBe('released');
  });
});
