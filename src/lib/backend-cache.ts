import type { BackendClient } from './backend-client.js';
import { applyBackendSnapshot } from './repo.js';

/** Fetch one authenticated Worker snapshot and atomically hydrate the IndexedDB cache.
 * The caller owns runtime configuration/authentication and decides when network refresh is safe.
 * A failed fetch leaves the existing offline cache untouched because hydration is never started. */
export async function refreshBackendCache(client: BackendClient): Promise<{ generatedAt: string }> {
  const snapshot = await client.getSnapshot();
  await applyBackendSnapshot(snapshot);
  return { generatedAt: snapshot.generatedAt };
}
