import type { MediaType, Title } from './types.js';

/** Stable title identity included in user exports. Provider-cache metadata is intentionally
 * excluded, but the crosswalk IDs needed to reconnect exported user-owned state are preserved. */
export interface ExportTitleIdentity {
  id: string;
  tmdbId: number;
  traktId?: number;
  imdbId?: string;
  availabilityId?: string;
  mediaType: MediaType;
  title: string;
  year: number;
}

export function exportTitleIdentity(title: Title): ExportTitleIdentity {
  return {
    id: title.id,
    tmdbId: title.tmdbId,
    traktId: title.traktId,
    imdbId: title.imdbId,
    availabilityId: title.availabilityId,
    mediaType: title.mediaType,
    title: title.title,
    year: title.year
  };
}
