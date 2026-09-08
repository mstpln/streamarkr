import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorkerBackendClient } from '../src/lib/backend-client.js';

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

test('WorkerBackendClient sends bearer auth and URL-encodes title ids', async () => {
  let seenUrl = '';
  let seenAuth = '';
  let seenMethod = '';
  const client = new WorkerBackendClient('https://worker.example/', 'synthetic-token', async (input, init) => {
    seenUrl = String(input);
    seenAuth = new Headers(init?.headers).get('authorization') ?? '';
    seenMethod = init?.method ?? 'GET';
    return jsonResponse({ ok: true });
  });
  await client.addToLibrary('series/with space');
  assert.equal(seenUrl, 'https://worker.example/api/library/series%2Fwith%20space');
  assert.equal(seenAuth, 'Bearer synthetic-token');
  assert.equal(seenMethod, 'PUT');
});

test('WorkerBackendClient sends JSON rating payloads', async () => {
  let body = '';
  let contentType = '';
  const client = new WorkerBackendClient('https://worker.example', 'synthetic-token', async (_input, init) => {
    body = String(init?.body ?? '');
    contentType = new Headers(init?.headers).get('content-type') ?? '';
    return jsonResponse({ ok: true });
  });
  await client.setRating('movie-1', 5);
  assert.equal(body, JSON.stringify({ stars: 5 }));
  assert.equal(contentType, 'application/json');
});

test('WorkerBackendClient exposes the complete user-state mutation surface', async () => {
  const seen: Array<{ url: string; method: string; body: string }> = [];
  const client = new WorkerBackendClient('https://worker.example', 'synthetic-token', async (input, init) => {
    seen.push({ url: String(input), method: init?.method ?? 'GET', body: String(init?.body ?? '') });
    if (String(input).endsWith('/api/overrides/season/series-1')) return jsonResponse({ ok: true, affectedEpisodes: 8 });
    if (String(input).endsWith('/api/services/custom')) return jsonResponse({ ok: true, serviceKey: 'criterion-channel' });
    return jsonResponse({ ok: true });
  });

  await client.setWatchedService('movie-1', 'netflix');
  await client.setWatchedService('movie-1', null);
  await client.setMovieOverride('movie-1', 'watched');
  await client.setEpisodeOverride('series-1', 2, 3, 'unwatched');
  const season = await client.setSeasonOverride('series-1', 2, 'watched');
  await client.setServiceSelected('hbo-max', true);
  const custom = await client.addCustomService('Criterion Channel');

  assert.deepEqual(season, { ok: true, affectedEpisodes: 8 });
  assert.deepEqual(custom, { ok: true, serviceKey: 'criterion-channel' });
  assert.deepEqual(seen.map((entry) => [entry.method, entry.url, entry.body]), [
    ['PUT', 'https://worker.example/api/watched-service/movie-1', JSON.stringify({ serviceKey: 'netflix' })],
    ['DELETE', 'https://worker.example/api/watched-service/movie-1', ''],
    ['PUT', 'https://worker.example/api/overrides/movie/movie-1', JSON.stringify({ state: 'watched' })],
    ['PUT', 'https://worker.example/api/overrides/episode/series-1', JSON.stringify({ seasonNumber: 2, episodeNumber: 3, state: 'unwatched' })],
    ['PUT', 'https://worker.example/api/overrides/season/series-1', JSON.stringify({ seasonNumber: 2, state: 'watched' })],
    ['PUT', 'https://worker.example/api/services/hbo-max/selected', JSON.stringify({ selected: true })],
    ['POST', 'https://worker.example/api/services/custom', JSON.stringify({ displayName: 'Criterion Channel' })]
  ]);
});

test('WorkerBackendClient surfaces backend failures without exposing credentials', async () => {
  const client = new WorkerBackendClient('https://worker.example', 'super-secret', async () => jsonResponse({ error: 'unauthorized' }, 401));
  await assert.rejects(() => client.getSnapshot(), (error: Error) => {
    assert.match(error.message, /401/);
    assert.match(error.message, /unauthorized/);
    assert.equal(error.message.includes('super-secret'), false);
    return true;
  });
});
