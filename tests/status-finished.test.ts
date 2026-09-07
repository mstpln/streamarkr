import { describe, it } from 'node:test';
import { expect } from './expect-shim.js';
import { computeSeriesStatus } from '../src/lib/status.js';
import type { Episode, WatchEvent } from '../src/lib/types.js';

const now = new Date('2026-09-05T12:00:00Z');

const episode: Episode = {
  titleId: 't1',
  seasonNumber: 1,
  episodeNumber: 1,
  tmdbEpisodeId: 101,
  name: 'Episode 1',
  runtime: 42,
  airDate: '2026-08-01T00:00:00Z',
  overview: ''
};

const event: WatchEvent = {
  id: 'w1',
  providerEventId: 'p1',
  titleId: 't1',
  seasonNumber: 1,
  episodeNumber: 1,
  watchedAt: '2026-08-10T00:00:00Z',
  source: 'trakt'
};

describe('Finished status provider semantics', () => {
  it('requires TMDB status Ended; a fully watched Canceled series remains Caught Up', () => {
    const status = computeSeriesStatus({
      titleId: 't1',
      episodes: [episode],
      metadataStatus: 'Canceled',
      events: [event],
      overrides: [],
      now
    });
    expect(status).toBe('Caught Up');
  });
});
