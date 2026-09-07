import type { AvailabilityEntry, Episode, Season, Title, TitleMetadata, WatchEvent } from '../src/lib/types.js';

export interface TmdbProvider {
  search(query: string, mediaType?: Title['mediaType']): Promise<Title[]>;
  getMetadata(titleId: string): Promise<TitleMetadata | undefined>;
  getSeasons(titleId: string): Promise<Season[]>;
  getEpisodes(titleId: string, seasonNumber: number): Promise<Episode[]>;
}

export interface TraktProvider {
  getHistorySince(checkpoint: string | null): Promise<{ events: WatchEvent[]; checkpoint: string | null }>;
}

export interface AvailabilityProvider {
  getAvailability(titleIds: string[]): Promise<AvailabilityEntry[]>;
}

export interface ProviderSet {
  tmdb: TmdbProvider;
  trakt: TraktProvider;
  availability: AvailabilityProvider;
}

/** No live implementation is committed in the public foundation build. Real adapters must be
 * injected by the Worker only after their credentials exist in Cloudflare secret storage. */
export function assertProvidersConfigured(providers: Partial<ProviderSet>): asserts providers is ProviderSet {
  if (!providers.tmdb || !providers.trakt || !providers.availability) {
    throw new Error('Streamarkr provider adapters are not configured');
  }
}
