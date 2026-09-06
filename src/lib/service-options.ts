import type { AvailabilityEntry, ServiceDef } from './types.js';

export interface ServiceOption {
  key: string;
  label: string;
}

function optionsForKeys(keys: Iterable<string>, services: ServiceDef[]): ServiceOption[] {
  const byKey = new Map(services.map((service) => [service.serviceKey, service]));
  return [...new Set(keys)]
    .filter(Boolean)
    .map((key) => ({ key, label: byKey.get(key)?.displayName ?? key }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Historical "where I watched it" is user-owned and remains usable even if that service is no
 * longer selected in Preferences. Only services actually referenced by the current History rows
 * are returned, so the filter stays relevant without losing deselected historical values. */
export function historicalServiceOptions(
  rows: Array<{ watchedService?: string }>,
  services: ServiceDef[]
): ServiceOption[] {
  return optionsForKeys(rows.map((row) => row.watchedService ?? ''), services);
}

/** Library's streaming-service filter reflects current availability represented in the visible
 * result set, not only the user's selected services. Selection affects prioritisation/Discover,
 * but must not hide a real current service from this filter. */
export function availabilityServiceOptions(
  rows: Array<{ availability: AvailabilityEntry[] }>,
  services: ServiceDef[]
): ServiceOption[] {
  return optionsForKeys(rows.flatMap((row) => row.availability.map((entry) => entry.serviceKey)), services);
}
