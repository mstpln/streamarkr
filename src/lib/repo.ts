export * from './local-repo.js';

import type { BackendClient } from './backend-client.js';
import * as local from './local-repo.js';

let backendClient: BackendClient | null = null;

export function configureBackendClient(client: BackendClient | null): void {
  backendClient = client;
}

async function activeClient(): Promise<BackendClient | null> {
  if (!(await local.backendCacheInfo()).active) return null;
  if (!backendClient) throw new Error('Worker/D1 cache is active but no backend client is configured.');
  return backendClient;
}

async function refreshAfterMutation(client: BackendClient): Promise<void> {
  const snapshot = await client.getSnapshot();
  await local.applyBackendSnapshot(snapshot);
}

export async function refreshBackendCache(): Promise<{ generatedAt: string }> {
  const client = await activeClient();
  if (!client) throw new Error('Worker/D1 backend is not active.');
  const snapshot = await client.getSnapshot();
  await local.applyBackendSnapshot(snapshot);
  return { generatedAt: snapshot.generatedAt };
}

export async function addToLibrary(titleId: string): Promise<void> {
  const client = await activeClient();
  if (!client) return local.addToLibrary(titleId);
  await client.addToLibrary(titleId);
  await refreshAfterMutation(client);
}

export async function removeFromLibrary(titleId: string): Promise<void> {
  const client = await activeClient();
  if (!client) return local.removeFromLibrary(titleId);
  await client.removeFromLibrary(titleId);
  await refreshAfterMutation(client);
}

export async function setRating(titleId: string, stars: 1 | 2 | 3 | 4 | 5): Promise<void> {
  const client = await activeClient();
  if (!client) return local.setRating(titleId, stars);
  await client.setRating(titleId, stars);
  await refreshAfterMutation(client);
}

export async function clearRating(titleId: string): Promise<void> {
  const client = await activeClient();
  if (!client) return local.clearRating(titleId);
  await client.clearRating(titleId);
  await refreshAfterMutation(client);
}

export async function setWatchedService(titleId: string, serviceKey: string | null): Promise<void> {
  const client = await activeClient();
  if (!client) return local.setWatchedService(titleId, serviceKey);
  await client.setWatchedService(titleId, serviceKey);
  await refreshAfterMutation(client);
}

export async function setEpisodeOverride(titleId: string, seasonNumber: number, episodeNumber: number, state: 'watched' | 'unwatched'): Promise<void> {
  const client = await activeClient();
  if (!client) return local.setEpisodeOverride(titleId, seasonNumber, episodeNumber, state);
  await client.setEpisodeOverride(titleId, seasonNumber, episodeNumber, state);
  await refreshAfterMutation(client);
}

export async function setSeasonOverride(titleId: string, seasonNumber: number, state: 'watched' | 'unwatched'): Promise<void> {
  const client = await activeClient();
  if (!client) return local.setSeasonOverride(titleId, seasonNumber, state);
  await client.setSeasonOverride(titleId, seasonNumber, state);
  await refreshAfterMutation(client);
}

export async function setMovieOverride(titleId: string, state: 'watched' | 'unwatched'): Promise<void> {
  const client = await activeClient();
  if (!client) return local.setMovieOverride(titleId, state);
  await client.setMovieOverride(titleId, state);
  await refreshAfterMutation(client);
}

export async function setServiceSelected(serviceKey: string, selected: boolean): Promise<void> {
  const client = await activeClient();
  if (!client) return local.setServiceSelected(serviceKey, selected);
  await client.setServiceSelected(serviceKey, selected);
  await refreshAfterMutation(client);
}

export async function addCustomService(displayName: string): Promise<void> {
  const client = await activeClient();
  if (!client) return local.addCustomService(displayName);
  await client.addCustomService(displayName);
  await refreshAfterMutation(client);
}

export async function markAlertsSeen(ids: string[]): Promise<void> {
  const client = await activeClient();
  if (!client) return local.markAlertsSeen(ids);
  await client.markAlertsSeen(ids);
  await refreshAfterMutation(client);
}

export async function resetToFixtures(): Promise<void> {
  if ((await local.backendCacheInfo()).active) {
    throw new Error('Reset to fixtures is disabled while Worker/D1 is the durable source of truth.');
  }
  await local.resetToFixtures();
}
