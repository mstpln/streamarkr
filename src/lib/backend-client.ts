import type { BackendSnapshot } from './backend-contract.js';
import type { Rating } from './types.js';

export interface BackendClient {
  getSnapshot(): Promise<BackendSnapshot>;
  addToLibrary(titleId: string): Promise<void>;
  removeFromLibrary(titleId: string): Promise<void>;
  setRating(titleId: string, stars: Rating['stars']): Promise<void>;
  clearRating(titleId: string): Promise<void>;
  markAlertsSeen(ids: string[]): Promise<void>;
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class WorkerBackendClient implements BackendClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly fetchImpl: FetchLike;

  constructor(baseUrl: string, token: string, fetchImpl: FetchLike = fetch) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
    this.fetchImpl = fetchImpl;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('authorization', `Bearer ${this.token}`);
    if (init.body != null && !headers.has('content-type')) headers.set('content-type', 'application/json');
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, headers });
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
  async markAlertsSeen(ids: string[]): Promise<void> {
    await this.request('/api/alerts/seen', { method: 'POST', body: JSON.stringify({ ids }) });
  }
}
