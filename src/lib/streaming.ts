import type { AvailabilityEntry, ServiceDef } from './types.js';

/** Pick the Detail page's single primary streaming action. User-selected services are preferred,
 * but selection is not an eligibility requirement: if the title is only available by subscription
 * on an unselected service, that real actionable destination should still be surfaced. */
export function choosePrimaryStreamingAction(
  availability: AvailabilityEntry[],
  services: ServiceDef[]
): AvailabilityEntry | null {
  const selected = new Set(services.filter((service) => service.userSelected).map((service) => service.serviceKey));
  return [...availability]
    .filter((entry) => entry.optionType === 'subscription' && !!entry.deepLink)
    .sort((a, b) => {
      const selectedOrder = Number(!selected.has(a.serviceKey)) - Number(!selected.has(b.serviceKey));
      return selectedOrder || a.serviceKey.localeCompare(b.serviceKey);
    })[0] ?? null;
}
