import type { BackendSnapshot } from './backend-contract.js';
import type { Rating, WatchOverride } from './types.js';

export interface BackendSessionStatus {
  authenticated: boolean;
  method?: 'device-token' | 'browser-session';
}

export interface BackendClient {
  getSnapshot(): Promise<BackendSnapshot>;
  addToLibrary(titleId: string): Promise<void>;
  removeFromLibrary(titleId: string): Promise<void>;
  setRating(titleId: string, stars: Rating['stars']): Promise<void>;
  clearRating(titleId: string): Promise<void>;
  setWatchedService(titleId: string, serviceKey: string | null): Promise<void>;
  setMovieOverride(titleId: string, state: WatchOverride['state']): Promise<void>;
  setEpisodeOverride(titleId: string, seasonNumber: number, episodeNumber: number, state: WatchOverride['state']): Promise<void>;
  setSeasonOverride(titleId: string, seasonNumber: number, state: WatchOverride['state']): Promise<{ affectedEpisodes: number }>;
  setServiceSelected(serviceKey: string, selected: boolean): Promise<void>;
  addCustomService(displayName: string): Promise<{ serviceKey: string }>;
  markAlertsSeen(ids: string[]): Promise<void>;
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class WorkerBackendClient implements BackendClient {
  private readonly baseUrl: string;
  private readonly token: string | null;
  private readonly fetchImpl: FetchLike;

  constructor(baseUrl: string, token: string | null = null, fetchImpl: FetchLike = fetch) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
    this.fetchImpl = fetchImpl;
  }

  private async request<T>(path: string, init: RequestInit = {}, bearerToken: string | null = this.token): Promise<T> {
    const headers = new Headers(init.headers);
    if (bearerToken) headers.set('authorization', `Bearer ${bearerToken}`);
    if (init.body != null && !headers.has('content-type')) headers.set('content-type', 'application/json');
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, headers, credentials: 'include' });
    if (!response.ok) {
      let detail = '';
      try {
        const payload = await response.json() as { error?: string; message?: string };
        detail = payload.message || payload.error || '';
      } catch {
        detail = '';
      }
      throw new Error(`Streamarkr backend request failed (${response.status})${detail ? `: ${detail}` : ''}`);
    }
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  }

  getSessionStatus(): Promise<BackendSessionStatus> {
    return this.request<BackendSessionStatus>('/api/auth/session');
  }

  async bootstrapSession(deviceAccessToken: string): Promise<{ expiresAt: string }> {
    const result = await this.request<{ ok: true; expiresAt: string }>('/api/auth/session', { method: 'POST' }, deviceAccessToken);
    return { expiresAt: result.expiresAt };
  }

  async clearSession(): Promise<void> {
    await this.request('/api/auth/session', { method: 'DELETE' }, null);
  }

  getSnapshot(): Promise<BackendSnapshot> {
    return this.request<BackendSnapshot>('/api/snapshot');
  }
  async addToLibrary(titleId: string): Promise<void> {
    await this.request(`/api/library/${encodeURIComponent(titleId)}`, { method: 'PUT' });
  }
  async removeFromLibrary(titleId: string): Promise<void> {
    await this.request(`/api/library/${encodeURIComponent(titleId)}`, { method: 'DELETE' });
  }
  async setRating(titleId: string, stars: Rating['stars']): Promise<void> {
    await this.request(`/api/ratings/${encodeURIComponent(titleId)}`, { method: 'PUT', body: JSON.stringify({ stars }) });
  }
  async clearRating(titleId: string): Promise<void> {
    await this.request(`/api/ratings/${encodeURIComponent(titleId)}`, { method: 'DELETE' });
  }
  async setWatchedService(titleId: string, serviceKey: string | null): Promise<void> {
    const path = `/api/watched-service/${encodeURIComponent(titleId)}`;
    if (serviceKey === null) {
      await this.request(path, { method: 'DELETE' });
      return;
    }
    await this.request(path, { method: 'PUT', body: JSON.stringify({ serviceKey }) });
  }
  async setMovieOverride(titleId: string, state: WatchOverride['state']): Promise<void> {
    await this.request(`/api/overrides/movie/${encodeURIComponent(titleId)}`, { method: 'PUT', body: JSON.stringify({ state }) });
  }
  async setEpisodeOverride(titleId: string, seasonNumber: number, episodeNumber: number, state: WatchOverride['state']): Promise<void> {
    await this.request(`/api/overrides/episode/${encodeURIComponent(titleId)}`, {
      method: 'PUT', body: JSON.stringify({ seasonNumber, episodeNumber, state })
    });
  }
  setSeasonOverride(titleId: string, seasonNumber: number, state: WatchOverride['state']): Promise<{ affectedEpisodes: number }> {
    return this.request(`/api/overrides/season/${encodeURIComponent(titleId)}`, {
      method: 'PUT', body: JSON.stringify({ seasonNumber, state })
    });
  }
  async setServiceSelected(serviceKey: string, selected: boolean): Promise<void> {
    await this.request(`/api/services/${encodeURIComponent(serviceKey)}/selected`, { method: 'PUT', body: JSON.stringify({ selected }) });
  }
  addCustomService(displayName: string): Promise<{ serviceKey: string }> {
    return this.request('/api/services/custom', { method: 'POST', body: JSON.stringify({ displayName }) });
  }
  async markAlertsSeen(ids: string[]): Promise<void> {
    await this.request('/api/alerts/seen', { method: 'POST', body: JSON.stringify({ ids }) });
  }
}
