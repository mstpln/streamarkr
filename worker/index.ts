import { isAuthorized } from './auth.js';
import {
  addLibraryItem,
  clearRating,
  loadSnapshot,
  markAlertsSeen,
  MissingCanonicalTitleError,
  removeLibraryItem,
  schemaVersion,
  setRating
} from './repository.js';
import type { Env } from './types.js';

function json(body: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extraHeaders }
  });
}

function corsHeaders(request: Request, env: Env): HeadersInit {
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

async function bodyJson<T>(request: Request): Promise<T | null> {
  try {
    return await request.json() as T;
  } catch {
    return null;
  }
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const cors = corsHeaders(request, env);

  if (request.method === 'OPTIONS') {
    if (!env.APP_ORIGIN || request.headers.get('origin') !== env.APP_ORIGIN) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: cors });
  }

  if (request.method === 'GET' && url.pathname === '/api/health') {
    let version = 0;
    try {
      version = await schemaVersion(env.DB);
    } catch {
      return json({ ok: false, service: 'streamarkr-worker', error: 'database_unavailable' }, 503, cors);
    }
    return json({ ok: true, service: 'streamarkr-worker', schemaVersion: version, authConfigured: Boolean(env.DEVICE_ACCESS_TOKEN) }, 200, cors);
  }

  if (!env.DEVICE_ACCESS_TOKEN) return json({ error: 'server_not_configured' }, 503, cors);
  if (!(await isAuthorized(request, env.DEVICE_ACCESS_TOKEN))) return json({ error: 'unauthorized' }, 401, cors);

  try {
    if (request.method === 'GET' && url.pathname === '/api/snapshot') return json(await loadSnapshot(env.DB), 200, cors);

    const libraryTitleId = routeTitleId(url.pathname, '/api/library/');
    if (libraryTitleId && request.method === 'PUT') {
      await addLibraryItem(env.DB, libraryTitleId, new Date().toISOString());
      return json({ ok: true }, 200, cors);
    }
    if (libraryTitleId && request.method === 'DELETE') {
      await removeLibraryItem(env.DB, libraryTitleId);
      return new Response(null, { status: 204, headers: cors });
    }

    const ratingTitleId = routeTitleId(url.pathname, '/api/ratings/');
    if (ratingTitleId && request.method === 'PUT') {
      const body = await bodyJson<{ stars?: number }>(request);
      if (!body || !Number.isInteger(body.stars) || (body.stars ?? 0) < 1 || (body.stars ?? 0) > 5) {
        return json({ error: 'invalid_rating' }, 400, cors);
      }
      await setRating(env.DB, ratingTitleId, body.stars as 1 | 2 | 3 | 4 | 5, new Date().toISOString());
      return json({ ok: true }, 200, cors);
    }
    if (ratingTitleId && request.method === 'DELETE') {
      await clearRating(env.DB, ratingTitleId);
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method === 'POST' && url.pathname === '/api/alerts/seen') {
      const body = await bodyJson<{ ids?: unknown }>(request);
      if (!body || !Array.isArray(body.ids) || body.ids.length > 30 || !body.ids.every((id) => typeof id === 'string')) {
        return json({ error: 'invalid_alert_ids' }, 400, cors);
      }
      await markAlertsSeen(env.DB, body.ids, new Date().toISOString());
      return json({ ok: true }, 200, cors);
    }
  } catch (error) {
    if (error instanceof MissingCanonicalTitleError) {
      return json({ error: 'missing_canonical_title', message: error.message }, 409, cors);
    }
    const message = error instanceof Error ? error.message : 'request_failed';
    return json({ error: 'request_failed', message }, 500, cors);
  }

  return json({ error: 'not_found' }, 404, cors);
}

export default { fetch(request: Request, env: Env): Promise<Response> { return handleRequest(request, env); } };
