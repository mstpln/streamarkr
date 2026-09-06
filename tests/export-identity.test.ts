import { describe, it } from 'node:test';
import { expect } from './expect-shim.js';
import { exportTitleIdentity } from '../src/lib/export.js';
import type { Title } from '../src/lib/types.js';

describe('exportTitleIdentity', () => {
  it('preserves all stable provider crosswalk IDs needed to reconnect user-owned data', () => {
    const title: Title = {
      id: 'series-123',
      mediaType: 'series',
      tmdbId: 123,
      traktId: 456,
      imdbId: 'tt0012345',
      availabilityId: 'availability-789',
      title: 'Synthetic Series',
      year: 2026
    };
    const exported = exportTitleIdentity(title);
    expect(exported.id).toBe('series-123');
    expect(exported.tmdbId).toBe(123);
    expect(exported.traktId).toBe(456);
    expect(exported.imdbId).toBe('tt0012345');
    expect(exported.availabilityId).toBe('availability-789');
  });

  it('does not invent missing optional provider IDs', () => {
    const title: Title = { id: 'movie-1', mediaType: 'movie', tmdbId: 1, title: 'Synthetic Movie', year: 2026 };
    const exported = exportTitleIdentity(title);
    expect(exported.traktId).toBe(undefined);
    expect(exported.imdbId).toBe(undefined);
    expect(exported.availabilityId).toBe(undefined);
  });
});
