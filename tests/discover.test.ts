import { describe, it } from 'node:test';
import { expect } from './expect-shim.js';
import { topPicks, similarTo, byGenre, type DiscoverContext } from '../src/lib/discover.js';
import type { AvailabilityEntry, LibraryItem, Rating, ServiceDef, Title, TitleMetadata } from '../src/lib/types.js';

const titles: Title[] = [
  { id: 's1', mediaType: 'series', tmdbId: 1, title: 'Rated Series', year: 2020 },
  { id: 's2', mediaType: 'series', tmdbId: 2, title: 'Eligible Candidate', year: 2021 },
  { id: 's3', mediaType: 'series', tmdbId: 3, title: 'In History Already', year: 2022 },
  { id: 's4', mediaType: 'series', tmdbId: 4, title: 'Not On My Services', year: 2023 },
  { id: 's5', mediaType: 'series', tmdbId: 5, title: 'Rent Only', year: 2024 }
];
const metadata: TitleMetadata[] = titles.map((t) => ({
  titleId: t.id, status: 'Returning Series', overview: '', genres: t.id === 's4' ? ['Comedy'] : ['Sci-Fi'], posterPath: '', backdropPath: '', trailerKey: null, metadataUpdatedAt: ''
}));
const libraryItems: LibraryItem[] = [{ titleId: 's1', addedAt: '', derivedStatus: 'Finished', statusComputedAt: '' }];
const ratings: Rating[] = [{ titleId: 's1', stars: 5, ratedAt: '' }];
const services: ServiceDef[] = [{ serviceKey: 'netflix', displayName: 'Netflix', logoGlyph: 'N', userSelected: true, availabilitySource: 'streaming-availability' }];
const availability: AvailabilityEntry[] = [
  { titleId: 's2', serviceKey: 'netflix', optionType: 'subscription', deepLink: null, startsAt: null, endsAt: null, checkedAt: '', source: 'streaming-availability' },
  { titleId: 's3', serviceKey: 'netflix', optionType: 'subscription', deepLink: null, startsAt: null, endsAt: null, checkedAt: '', source: 'streaming-availability' },
  { titleId: 's4', serviceKey: 'hbo-max', optionType: 'subscription', deepLink: null, startsAt: null, endsAt: null, checkedAt: '', source: 'streaming-availability' },
  { titleId: 's5', serviceKey: 'netflix', optionType: 'rent', deepLink: null, startsAt: null, endsAt: null, checkedAt: '', source: 'streaming-availability' }
];
const ctx: DiscoverContext = { titles, metadata, libraryItems, historyTitleIds: new Set(['s3']), availability, services, ratings };

describe('Discover', () => {
  it('topPicks excludes History and Library titles', () => {
    const cards = topPicks('series', ctx);
    const ids = cards.map((c) => c.title.id);
    expect(ids).not.toContain('s1'); // library
    expect(ids).not.toContain('s3'); // history
  });

  it('excludes titles only available to rent/buy or on a non-selected service', () => {
    const cards = topPicks('series', ctx);
    const ids = cards.map((c) => c.title.id);
    expect(ids).not.toContain('s4'); // not on a selected service
    expect(ids).not.toContain('s5'); // rent only
    expect(ids).toContain('s2'); // eligible: subscription on a selected service, shares genre with 5-star seed
  });

  it('similarTo stays within the same media type and matches genre', () => {
    const cards = similarTo('s1', ctx);
    expect(cards.every((c) => c.title.mediaType === 'series')).toBe(true);
    expect(cards.map((c) => c.title.id)).toContain('s2');
  });

  it('byGenre only returns eligible titles in the requested genre', () => {
    const cards = byGenre('series', 'Sci-Fi', ctx);
    expect(cards.map((c) => c.title.id)).toEqual(['s2']);
  });
});

describe('Discover — Correction 7 (By Genre personalisation)', () => {
  const rankTitles: Title[] = [
    { id: 'seed5', mediaType: 'series', tmdbId: 90, title: 'Five Star Seed', year: 2019 },
    { id: 'seed3', mediaType: 'series', tmdbId: 91, title: 'Three Star Seed', year: 2019 },
    { id: 'strong', mediaType: 'series', tmdbId: 92, title: 'Strong Match', year: 2021 },
    { id: 'weak', mediaType: 'series', tmdbId: 93, title: 'Weak Match', year: 2021 }
  ];
  const rankMetadata: TitleMetadata[] = [
    { titleId: 'seed5', status: 'Ended', overview: '', genres: ['Drama', 'Thriller'], posterPath: '', backdropPath: '', trailerKey: null, metadataUpdatedAt: '' },
    { titleId: 'seed3', status: 'Ended', overview: '', genres: ['Drama'], posterPath: '', backdropPath: '', trailerKey: null, metadataUpdatedAt: '' },
    { titleId: 'strong', status: 'Returning Series', overview: '', genres: ['Drama', 'Thriller'], posterPath: '', backdropPath: '', trailerKey: null, metadataUpdatedAt: '' },
    { titleId: 'weak', status: 'Returning Series', overview: '', genres: ['Drama'], posterPath: '', backdropPath: '', trailerKey: null, metadataUpdatedAt: '' }
  ];
  const rankServices: ServiceDef[] = [{ serviceKey: 'netflix', displayName: 'Netflix', logoGlyph: 'N', userSelected: true, availabilitySource: 'streaming-availability' }];
  const rankAvailability: AvailabilityEntry[] = ['strong', 'weak'].map((id) => ({
    titleId: id, serviceKey: 'netflix', optionType: 'subscription', deepLink: null, startsAt: null, endsAt: null, checkedAt: '', source: 'streaming-availability'
  }));
  const rankRatings: Rating[] = [
    { titleId: 'seed5', stars: 5, ratedAt: '' },
    { titleId: 'seed3', stars: 3, ratedAt: '' }
  ];
  const rankCtx: DiscoverContext = {
    titles: rankTitles, metadata: rankMetadata, libraryItems: [{ titleId: 'seed5', addedAt: '', derivedStatus: 'Finished', statusComputedAt: '' }, { titleId: 'seed3', addedAt: '', derivedStatus: 'Finished', statusComputedAt: '' }],
    historyTitleIds: new Set(), availability: rankAvailability, services: rankServices, ratings: rankRatings
  };

  it('ranks a title matching a 5-star-rated genre profile above one that only matches a 3-star profile', () => {
    const cards = byGenre('series', 'Drama', rankCtx);
    expect(cards.map((c) => c.title.id)).toEqual(['strong', 'weak']);
  });

  it('excludes History/Library titles even when they would rank highly', () => {
    const cards = byGenre('series', 'Drama', rankCtx);
    expect(cards.map((c) => c.title.id)).not.toContain('seed5');
  });

  it('is deterministic across repeated calls with the same inputs', () => {
    const first = byGenre('series', 'Drama', rankCtx).map((c) => c.title.id);
    const second = byGenre('series', 'Drama', rankCtx).map((c) => c.title.id);
    expect(first).toEqual(second);
  });
});
