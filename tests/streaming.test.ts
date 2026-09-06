import { describe, it } from 'node:test';
import { expect } from './expect-shim.js';
import { choosePrimaryStreamingAction } from '../src/lib/streaming.js';
import type { AvailabilityEntry, ServiceDef } from '../src/lib/types.js';

const services: ServiceDef[] = [
  { serviceKey: 'selected', displayName: 'Selected', logoGlyph: 'S', userSelected: true, availabilitySource: 'streaming-availability' },
  { serviceKey: 'other', displayName: 'Other', logoGlyph: 'O', userSelected: false, availabilitySource: 'streaming-availability' }
];

function availability(serviceKey: string, optionType: AvailabilityEntry['optionType'], deepLink: string | null): AvailabilityEntry {
  return {
    titleId: 'movie-1', serviceKey, optionType, deepLink,
    startsAt: null, endsAt: null, checkedAt: '2026-09-07T00:00:00Z', source: 'streaming-availability'
  };
}

describe('choosePrimaryStreamingAction', () => {
  it('prioritizes an actionable selected subscription service', () => {
    const result = choosePrimaryStreamingAction([
      availability('other', 'subscription', 'https://example.test/other'),
      availability('selected', 'subscription', 'https://example.test/selected')
    ], services);
    expect(result?.serviceKey).toBe('selected');
  });

  it('falls back to an actionable unselected subscription service when that is the only option', () => {
    const result = choosePrimaryStreamingAction([
      availability('other', 'subscription', 'https://example.test/other')
    ], services);
    expect(result?.serviceKey).toBe('other');
  });

  it('does not promote rent/buy or entries without a deep link', () => {
    const result = choosePrimaryStreamingAction([
      availability('selected', 'rent', 'https://example.test/rent'),
      availability('other', 'subscription', null)
    ], services);
    expect(result).toBeNull();
  });
});
