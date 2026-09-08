// Correction 15: deterministic IndexedDB/repository integration test. Runs the REAL db.ts +
// repo.ts code path (no mocking of repo functions) against the in-memory fake IndexedDB in
// fake-indexeddb.ts, since node:test has no browser IndexedDB and the external `fake-indexeddb`
// package is unavailable in this offline environment. See TESTS.md for the full rationale.
import { describe, it, before } from 'node:test';
import { expect } from './expect-shim.js';
import { installFakeIndexedDB } from './fake-indexeddb.js';

installFakeIndexedDB();

const repo = await import('../src/lib/repo.js');
const F = await import('../src/lib/fixtures.js');
const Resolve = await import('../src/lib/resolve.js');

describe('repo + db integration (fake IndexedDB)', () => {
  before(async () => {
    await repo.ensureSeeded();
  });

  it('seeds every fixture table on first run', async () => {
    const titles = await repo.allTitles();
    expect(titles.length).toBe(F.TITLES.length);
    const services = await repo.allServices();
    expect(services.length).toBe(F.SERVICES.length);
  });

  it('is idempotent — calling ensureSeeded again does not duplicate rows', async () => {
    await repo.ensureSeeded();
    const titles = await repo.allTitles();
    expect(titles.length).toBe(F.TITLES.length);
  });

  it('addToLibrary persists a real library_items row readable back via getTitleBundle', async () => {
    const id = F.TITLES[0].id;
    await repo.removeFromLibrary(id); // start clean regardless of fixture state
    expect(await repo.isInLibrary(id)).toBe(false);
    await repo.addToLibrary(id);
    expect(await repo.isInLibrary(id)).toBe(true);
    const bundle = await repo.getTitleBundle(id);
    expect(bundle?.library?.titleId).toBe(id);
  });

  it('removeFromLibrary clears membership but leaves ratings/overrides untouched (ownership boundary)', async () => {
    const id = F.TITLES[0].id;
    await repo.addToLibrary(id);
    await repo.setRating(id, 5);
    await repo.removeFromLibrary(id);
    expect(await repo.isInLibrary(id)).toBe(false);
    const bundle = await repo.getTitleBundle(id);
    expect(bundle?.rating?.stars).toBe(5);
  });

  it('setRating overwrites rather than duplicating a rating row', async () => {
    const id = F.TITLES[1].id;
    await repo.setRating(id, 3);
    await repo.setRating(id, 4);
    const ratings = await repo.allRatings();
    const mine = ratings.filter((r) => r.titleId === id);
    expect(mine.length).toBe(1);
    expect(mine[0].stars).toBe(4);
  });

  it('setEpisodeOverride writes a real watch_overrides row reflected in getTitleBundle', async () => {
    const series = F.TITLES.find((t) => t.mediaType === 'series')!;
    const ep = F.EPISODES.find((e) => e.titleId === series.id);
    if (!ep) return; // no episode fixtures for this synthetic title, nothing to assert
    await repo.setEpisodeOverride(series.id, ep.seasonNumber, ep.episodeNumber, 'watched');
    const bundle = await repo.getTitleBundle(series.id);
    const ov = bundle?.overrides.find(
      (o) => o.scopeType === 'episode' && o.seasonNumber === ep.seasonNumber && o.episodeNumber === ep.episodeNumber
    );
    expect(ov?.state).toBe('watched');
  });

  it('season bulk actions are bounded to currently released known episodes and do not wildcard future episodes', async () => {
    await repo.resetToFixtures();
    const series = F.TITLES.find((t) => t.id === 'series-1003')!;
    const seasonNumber = 1;
    await repo.setSeasonOverride(series.id, seasonNumber, 'watched');
    const overrides = await repo.allOverrides();
    expect(overrides.some((o) => o.scopeType === 'season' && o.titleId === series.id && o.seasonNumber === seasonNumber)).toBe(false);
    expect(overrides.some((o) => o.scopeType === 'episode' && o.titleId === series.id && o.seasonNumber === seasonNumber)).toBe(true);

    const resolvedFuture = Resolve.resolveEpisode(series.id, seasonNumber, 999, await repo.allEvents(), overrides);
    expect(resolvedFuture.watched).toBe(false);
  });

  it('local custom service keys match the Worker route-safe normalization and reject collisions', async () => {
    await repo.resetToFixtures();
    await repo.addCustomService('MUBI + More');
    let services = await repo.allServices();
    expect(services.some((service) => service.serviceKey === 'mubi-more' && service.displayName === 'MUBI + More')).toBe(true);

    let collisionThrew = false;
    try {
      await repo.addCustomService('MUBI More');
    } catch {
      collisionThrew = true;
    }
    expect(collisionThrew).toBe(true);
    services = await repo.allServices();
    expect(services.filter((service) => service.serviceKey === 'mubi-more').length).toBe(1);
  });

  it('local custom service creation refuses names that cannot be addressed by the Worker routes', async () => {
    await repo.resetToFixtures();
    const before = (await repo.allServices()).length;
    await repo.addCustomService('A'.repeat(81));
    await repo.addCustomService('!!!');
    const services = await repo.allServices();
    expect(services.length).toBe(before);
    expect(services.some((service) => service.serviceKey.length > 80)).toBe(false);
  });

  it('adding an existing same-name service reselects it instead of creating a duplicate', async () => {
    await repo.resetToFixtures();
    await repo.setServiceSelected('netflix', false);
    await repo.addCustomService('netflix');
    const services = await repo.allServices();
    const netflix = services.find((service) => service.serviceKey === 'netflix');
    expect(netflix?.userSelected).toBe(true);
    expect(services.filter((service) => service.serviceKey === 'netflix').length).toBe(1);
  });

  it('watched-service writes require a selected service but historical values survive later deselection', async () => {
    await repo.resetToFixtures();
    const id = F.TITLES[1].id;
    expect((await repo.allWatchedService()).some((row) => row.titleId === id && row.serviceKey === 'netflix')).toBe(false);

    await repo.setServiceSelected('netflix', false);
    let threw = false;
    try {
      await repo.setWatchedService(id, 'netflix');
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
    expect((await repo.allWatchedService()).some((row) => row.titleId === id && row.serviceKey === 'netflix')).toBe(false);

    await repo.setServiceSelected('netflix', true);
    await repo.setWatchedService(id, 'netflix');
    await repo.setServiceSelected('netflix', false);
    expect((await repo.allWatchedService()).some((row) => row.titleId === id && row.serviceKey === 'netflix')).toBe(true);
  });

  it('buildExportPayload (Correction 14) includes every user-owned data category', async () => {
    await repo.resetToFixtures();
    await repo.setServiceSelected('netflix', true);
    const id = F.TITLES[0].id;
    await repo.addToLibrary(id);
    await repo.setRating(id, 5);
    await repo.setWatchedService(id, 'netflix');
    const payload = await repo.buildExportPayload();
    expect(payload.library.some((l) => l.titleId === id)).toBe(true);
    expect(payload.ratings.some((r) => r.titleId === id && r.stars === 5)).toBe(true);
    expect(payload.watchedService.some((w) => w.titleId === id && w.serviceKey === 'netflix')).toBe(true);
    expect(Array.isArray(payload.watchEvents)).toBe(true);
    expect(Array.isArray(payload.preferences.selectedServices)).toBe(true);
    expect(Array.isArray(payload.alerts)).toBe(true);
    expect(payload.titles.some((t) => t.id === id)).toBe(true);
    expect(typeof payload.exportedAt).toBe('string');
  });

  it('final-pass fix: reconcileAvailability removes stale provider-owned rows a newer snapshot no longer contains', async () => {
    const titleId = F.TITLES[0].id;
    await repo.reconcileAvailability([
      { titleId, serviceKey: 'netflix', optionType: 'subscription', deepLink: null, startsAt: null, endsAt: null, checkedAt: new Date().toISOString(), source: 'streaming-availability' }
    ]);
    let current = (await repo.allAvailability()).filter((a) => a.titleId === titleId);
    expect(current.some((a) => a.serviceKey === 'netflix')).toBe(true);

    // Next provider snapshot no longer contains Netflix for this title.
    await repo.reconcileAvailability([
      { titleId, serviceKey: 'hbo-max', optionType: 'subscription', deepLink: null, startsAt: null, endsAt: null, checkedAt: new Date().toISOString(), source: 'streaming-availability' }
    ]);
    current = (await repo.allAvailability()).filter((a) => a.titleId === titleId);
    expect(current.some((a) => a.serviceKey === 'netflix')).toBe(false);
    expect(current.some((a) => a.serviceKey === 'hbo-max')).toBe(true);
  });

  it('final-pass fix: reconcileAvailability never touches user-owned stores', async () => {
    const id = F.TITLES[0].id;
    await repo.addToLibrary(id);
    await repo.setRating(id, 5);
    await repo.reconcileAvailability([]); // wipe all provider availability
    expect(await repo.isInLibrary(id)).toBe(true);
    const ratings = await repo.allRatings();
    expect(ratings.some((r) => r.titleId === id && r.stars === 5)).toBe(true);
  });

  it('final-pass fix (Correction 9): addToLibrary refuses to create a dangling Library membership for an unknown titleId', async () => {
    let threw = false;
    try {
      await repo.addToLibrary('does-not-exist-anywhere');
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
    expect(await repo.isInLibrary('does-not-exist-anywhere')).toBe(false);
  });

  it('resetToFixtures clears all data and reseeds from the fixture set', async () => {
    await repo.addCustomService('Made Up Service');
    await repo.resetToFixtures();
    const services = await repo.allServices();
    expect(services.length).toBe(F.SERVICES.length);
    expect(services.some((s) => s.serviceKey === 'made-up-service')).toBe(false);
  });
});