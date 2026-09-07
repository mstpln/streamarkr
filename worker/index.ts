import { isAuthorized } from './auth.js';
import {
  addCustomService,
  addLibraryItem,
  clearRating,
  loadSnapshot,
  markAlertsSeen,
  MissingCanonicalTitleError,
  MissingEpisodeError,
  MissingServiceError,
  removeLibraryItem,
  schemaVersion,
  setEpisodeOverride,
  setMovieOverride,
  setRating,
  setSeasonOverride,
  setServiceSelected,
  setWatchedService
} from './repository.js';
import type { Env } from './types.js';
import type { WatchOverride } from '../src/lib/types.js';

function json(body: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extraHeaders }
  });
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('origin');
  if (!origin || !env.APP_ORIGIN || origin !== env.APP_ORIGIN) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, PUT, DELETE, POST, OPTIONS',
    vary: 'Origin'
  };
}

function routeTitleId(pathname: string, prefix: string): string | null {
  if (!pathname.startsWith(prefix)) return null;
  const raw = pathname.slice(prefix.length);
  if (!raw || raw.includes('/')) return null;
  try {
    const decoded = decodeURIComponent(raw);
    return /^(series|movie)-\d+$/.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function routeServiceSelectedKey(pathname: string): string | null {
  const prefix = '/api/services/';
  const suffix = '/selected';
  if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) return null;
  const raw = pathname.slice(prefix.length, -suffix.length);
  if (!raw || raw.includes('/')) return null;
  try {
    const decoded = decodeURIComponent(raw);
    return /^[a-z0-9][a-z0-9-]{0,79}$/.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

async function bodyJson<T>(request: Request): Promise<T | null> {
  try {
    return await request.json() as T;
  } catch {
    return null;
  }
}

function validOverrideState(value: unknown): value is WatchOverride['state'] {
  return value === 'watched' || value === 'unwatched';
}

function positiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const requestId = crypto.randomUUID();
  const responseHeaders = { ...corsHeaders(request, env), 'x-request-id': requestId };

  if (request.method === 'OPTIONS') {
    if (!env.APP_ORIGIN || request.headers.get('origin') !== env.APP_ORIGIN) {
      return new Response(null, { status: 403, headers: { 'x-request-id': requestId } });
    }
    return new Response(null, { status: 204, headers: responseHeaders });
  }

  if (request.method === 'GET' && url.pathname === '/api/health') {
    let version = 0;
    try {
      version = await schemaVersion(env.DB);
    } catch {
      console.error(JSON.stringify({ level: 'error', requestId, route: '/api/health', error: 'DatabaseUnavailable' }));
      return json({ ok: false, service: 'streamarkr-worker', error: 'database_unavailable', requestId }, 503, responseHeaders);
    }
    return json({ ok: true, service: 'streamarkr-worker', schemaVersion: version, authConfigured: Boolean(env.DEVICE_ACCESS_TOKEN) }, 200, responseHeaders);
  }

  if (!env.DEVICE_ACCESS_TOKEN) return json({ error: 'server_not_configured' }, 503, responseHeaders);
  if (!(await isAuthorized(request, env.DEVICE_ACCESS_TOKEN))) return json({ error: 'unauthorized' }, 401, responseHeaders);

  try {
    if (request.method === 'GET' && url.pathname === '/api/snapshot') return json(await loadSnapshot(env.DB), 200, responseHeaders);

    const libraryTitleId = routeTitleId(url.pathname, '/api/library/');
    if (libraryTitleId && request.method === 'PUT') {
      await addLibraryItem(env.DB, libraryTitleId, new Date().toISOString());
      return json({ ok: true }, 200, responseHeaders);
    }
    if (libraryTitleId && request.method === 'DELETE') {
      await removeLibraryItem(env.DB, libraryTitleId);
      return new Response(null, { status: 204, headers: responseHeaders });
    }

    const ratingTitleId = routeTitleId(url.pathname, '/api/ratings/');
    if (ratingTitleId && request.method === 'PUT') {
      const body = await bodyJson<{ stars?: number }>(request);
      if (!body || !Number.isInteger(body.stars) || (body.stars ?? 0) < 1 || (body.stars ?? 0) > 5) {
        return json({ error: 'invalid_rating' }, 400, responseHeaders);
      }
      await setRating(env.DB, ratingTitleId, body.stars as 1 | 2 | 3 | 4 | 5, new Date().toISOString());
      return json({ ok: true }, 200, responseHeaders);
    }
    if (ratingTitleId && request.method === 'DELETE') {
      await clearRating(env.DB, ratingTitleId);
      return new Response(null, { status: 204, headers: responseHeaders });
    }

    const watchedServiceTitleId = routeTitleId(url.pathname, '/api/watched-service/');
    if (watchedServiceTitleId && request.method === 'PUT') {
      const body = await bodyJson<{ serviceKey?: unknown }>(request);
      if (!body || typeof body.serviceKey !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(body.serviceKey)) {
        return json({ error: 'invalid_service_key' }, 400, responseHeaders);
      }
      await setWatchedService(env.DB, watchedServiceTitleId, body.serviceKey, new Date().toISOString());
      return json({ ok: true }, 200, responseHeaders);
    }
    if (watchedServiceTitleId && request.method === 'DELETE') {
      await setWatchedService(env.DB, watchedServiceTitleId, null, new Date().toISOString());
      return new Response(null, { status: 204, headers: responseHeaders });
    }

    const movieOverrideTitleId = routeTitleId(url.pathname, '/api/overrides/movie/');
    if (movieOverrideTitleId && request.method === 'PUT') {
      const body = await bodyJson<{ state?: unknown }>(request);
      if (!body || !validOverrideState(body.state)) return json({ error: 'invalid_override_state' }, 400, responseHeaders);
      await setMovieOverride(env.DB, movieOverrideTitleId, body.state, new Date().toISOString());
      return json({ ok: true }, 200, responseHeaders);
    }

    const episodeOverrideTitleId = routeTitleId(url.pathname, '/api/overrides/episode/');
    if (episodeOverrideTitleId && request.method === 'PUT') {
      const body = await bodyJson<{ seasonNumber?: unknown; episodeNumber?: unknown; state?: unknown }>(request);
      if (!body || !positiveInteger(body.seasonNumber) || !positiveInteger(body.episodeNumber) || !validOverrideState(body.state)) {
        return json({ error: 'invalid_episode_override' }, 400, responseHeaders);
      }
      await setEpisodeOverride(env.DB, episodeOverrideTitleId, body.seasonNumber, body.episodeNumber, body.state, new Date().toISOString());
      return json({ ok: true }, 200, responseHeaders);
    }

    const seasonOverrideTitleId = routeTitleId(url.pathname, '/api/overrides/season/');
    if (seasonOverrideTitleId && request.method === 'PUT') {
      const body = await bodyJson<{ seasonNumber?: unknown; state?: unknown }>(request);
      if (!body || !positiveInteger(body.seasonNumber) || !validOverrideState(body.state)) {
        return json({ error: 'invalid_season_override' }, 400, responseHeaders);
      }
      const affectedEpisodes = await setSeasonOverride(env.DB, seasonOverrideTitleId, body.seasonNumber, body.state, new Date().toISOString());
      return json({ ok: true, affectedEpisodes }, 200, responseHeaders);
    }

    const serviceSelectedKey = routeServiceSelectedKey(url.pathname);
    if (serviceSelectedKey && request.method === 'PUT') {
      const body = await bodyJson<{ selected?: unknown }>(request);
      if (!body || typeof body.selected !== 'boolean') return json({ error: 'invalid_service_selection' }, 400, responseHeaders);
      await setServiceSelected(env.DB, serviceSelectedKey, body.selected);
      return json({ ok: true }, 200, responseHeaders);
    }

    if (request.method === 'POST' && url.pathname === '/api/services/custom') {
      const body = await bodyJson<{ displayName?: unknown }>(request);
      if (!body || typeof body.displayName !== 'string') return json({ error: 'invalid_service_name' }, 400, responseHeaders);
      const displayName = body.displayName.trim();
      if (!displayName || displayName.length > 80 || !/[a-z0-9]/i.test(displayName)) return json({ error: 'invalid_service_name' }, 400, responseHeaders);
      const serviceKey = await addCustomService(env.DB, displayName);
      return json({ ok: true, serviceKey }, 200, responseHeaders);
    }

    if (request.method === 'POST' && url.pathname === '/api/alerts/seen') {
      const body = await bodyJson<{ ids?: unknown }>(request);
      if (!body || !Array.isArray(body.ids) || body.ids.length > 30 || !body.ids.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 200)) {
        return json({ error: 'invalid_alert_ids' }, 400, responseHeaders);
      }
      await markAlertsSeen(env.DB, body.ids, new Date().toISOString());
      return json({ ok: true }, 200, responseHeaders);
    }
  } catch (error) {
    if (error instanceof MissingCanonicalTitleError) {
      return json({ error: 'missing_canonical_title', message: error.message }, 409, responseHeaders);
    }
    if (error instanceof MissingServiceError) {
      return json({ error: 'missing_service', message: error.message }, 409, responseHeaders);
    }
    if (error instanceof MissingEpisodeError) {
      return json({ error: 'missing_episode', message: error.message }, 409, responseHeaders);
    }
    console.error(JSON.stringify({
      level: 'error',
      requestId,
      method: request.method,
      route: url.pathname,
      error: error instanceof Error ? error.name : 'UnknownError'
    }));
    return json({ error: 'request_failed', requestId }, 500, responseHeaders);
  }

  return json({ error: 'not_found' }, 404, responseHeaders);
}

export default { fetch(request: Request, env: Env): Promise<Response> { return handleRequest(request, env); } };
