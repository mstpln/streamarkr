import { describe, it } from 'node:test';
import { expect } from './expect-shim.js';
import { availabilityServiceOptions, historicalServiceOptions } from '../src/lib/service-options.js';
import type { AvailabilityEntry, ServiceDef } from '../src/lib/types.js';

const services: ServiceDef[] = [
  { serviceKey: 'netflix', displayName: 'Netflix', logoGlyph: 'N', userSelected: true, availabilitySource: 'streaming-availability' },
  { serviceKey: 'max', displayName: 'HBO Max', logoGlyph: 'MAX', userSelected: false, availabilitySource: 'streaming-availability' }
];

const maxAvailability: AvailabilityEntry = {
  titleId: 't1',
  serviceKey: 'max',
  optionType: 'subscription',
  deepLink: 'https://example.test/max',
  startsAt: null,
  endsAt: null,
  checkedAt: '2026-09-07T00:00:00Z',
  source: 'streaming-availability'
};

describe('service filter options', () => {
  it('keeps deselected services available for historical watched-service filtering', () => {
    const options = historicalServiceOptions([{ watchedService: 'max' }], services);
    expect(options.length).toBe(1);
    expect(options[0].key).toBe('max');
    expect(options[0].label).toBe('HBO Max');
  });

  it('keeps current availability services in Library filtering even when not selected in Preferences', () => {
    const options = availabilityServiceOptions([{ availability: [maxAvailability] }], services);
    expect(options.length).toBe(1);
    expect(options[0].key).toBe('max');
    expect(options[0].label).toBe('HBO Max');
  });

  it('preserves an unknown historical key instead of silently dropping user-owned history', () => {
    const options = historicalServiceOptions([{ watchedService: 'legacy-service' }], services);
    expect(options[0].key).toBe('legacy-service');
    expect(options[0].label).toBe('legacy-service');
  });
});
