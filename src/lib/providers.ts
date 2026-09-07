// Fake provider adapters. Real asynchronous shape (Promise + simulated latency) so UI code
// written against these interfaces would not need to change when real TraktAdapter/TmdbAdapter/
// AvailabilityAdapter are introduced. No network call is ever made here.
import * as F from './fixtures.js';
import type { AvailabilityEntry, Episode, Season, Title, TitleMetadata, WatchEvent } from './types.js';

function delay<T>(value: T, ms = 220): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const TmdbAdapter = {
  async search(query: string): Promise<Title[]> {
    const q = query.trim().toLowerCase();
    if (!q) return delay([], 80);
    return delay(F.TITLES.filter((t) => t.title.toLowerCase().includes(q)), 180);
  },
  async getMetadata(titleId: string): Promise<TitleMetadata | undefined> {
    return delay(F.TITLE_METADATA.find((m) => m.titleId === titleId), 150);
  },
  async getSeasons(titleId: string): Promise<Season[]> {
    return delay(F.SEASONS.filter((s) => s.titleId === titleId), 150);
  },
  async getEpisodes(titleId: string, seasonNumber: number): Promise<Episode[]> {
    return delay(F.EPISODES.filter((e) => e.titleId === titleId && e.seasonNumber === seasonNumber), 150);
  },
  async getAllEpisodes(titleId: string): Promise<Episode[]> {
    return delay(F.EPISODES.filter((e) => e.titleId === titleId), 150);
  }
};

export const TraktAdapter = {
  connected: false as boolean,
  async getHistory(): Promise<WatchEvent[]> {
    return delay(F.WATCH_EVENTS, 260);
  }
};

export const AvailabilityAdapter = {
  async getAvailability(titleId: string): Promise<AvailabilityEntry[]> {
    return delay(F.AVAILABILITY.filter((a) => a.titleId === titleId), 200);
  },
  async getAllAvailability(): Promise<AvailabilityEntry[]> {
    return delay(F.AVAILABILITY, 200);
  }
};
