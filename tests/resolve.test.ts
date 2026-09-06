import { describe, it } from 'node:test';
import { expect } from './expect-shim.js';
import { resolveEpisode, resolveMovie, lastActivityAt } from '../src/lib/resolve.js';
import type { WatchEvent, WatchOverride } from '../src/lib/types.js';

describe('resolveEpisode', () => {
  it('treats an episode as unwatched with no event and no override', () => {
    expect(resolveEpisode('t1', 1, 1, [], []).watched).toBe(false);
  });

  it('treats an episode as watched when a provider event exists', () => {
    const events: WatchEvent[] = [{ id: 'e1', providerEventId: 'p1', titleId: 't1', seasonNumber: 1, episodeNumber: 1, watchedAt: '2026-01-01T00:00:00Z', source: 'trakt' }];
    const r = resolveEpisode('t1', 1, 1, events, []);
    expect(r.watched).toBe(true);
    expect(r.viaOverride).toBe(false);
  });

  it('a manual unwatched override wins over a provider watch event and is not silently flipped back', () => {
    const events: WatchEvent[] = [{ id: 'e1', providerEventId: 'p1', titleId: 't1', seasonNumber: 1, episodeNumber: 1, watchedAt: '2026-01-01T00:00:00Z', source: 'trakt' }];
    const overrides: WatchOverride[] = [{ id: 'o1', scopeType: 'episode', titleId: 't1', seasonNumber: 1, episodeNumber: 1, state: 'unwatched', changedAt: '2026-02-01T00:00:00Z' }];
    const r = resolveEpisode('t1', 1, 1, events, overrides);
    expect(r.watched).toBe(false);
    expect(r.viaOverride).toBe(true);
  });

  it('a season-level override applies to its episodes when no episode-level override exists', () => {
    const overrides: WatchOverride[] = [{ id: 'o1', scopeType: 'season', titleId: 't1', seasonNumber: 1, state: 'watched', changedAt: '2026-02-01T00:00:00Z' }];
    expect(resolveEpisode('t1', 1, 3, [], overrides).watched).toBe(true);
  });

  it('an episode-level override takes precedence over a season-level override', () => {
    const overrides: WatchOverride[] = [
      { id: 'o1', scopeType: 'season', titleId: 't1', seasonNumber: 1, state: 'watched', changedAt: '2026-02-01T00:00:00Z' },
      { id: 'o2', scopeType: 'episode', titleId: 't1', seasonNumber: 1, episodeNumber: 3, state: 'unwatched', changedAt: '2026-02-02T00:00:00Z' }
    ];
    expect(resolveEpisode('t1', 1, 3, [], overrides).watched).toBe(false);
  });
});

describe('resolveMovie', () => {
  it('a manual watched override with no provider event does not fabricate a watched date', () => {
    const overrides: WatchOverride[] = [{ id: 'o1', scopeType: 'movie', titleId: 'm1', state: 'watched', changedAt: '2026-02-01T00:00:00Z' }];
    const r = resolveMovie('m1', [], overrides);
    expect(r.watched).toBe(true);
    expect(r.watchedAt).toBeNull();
  });
});

describe('lastActivityAt', () => {
  it('considers both provider events and override changes as activity', () => {
    const events: WatchEvent[] = [{ id: 'e1', providerEventId: 'p1', titleId: 't1', watchedAt: '2026-01-01T00:00:00Z', source: 'trakt' }];
    const overrides: WatchOverride[] = [{ id: 'o1', scopeType: 'movie', titleId: 't1', state: 'unwatched', changedAt: '2026-03-01T00:00:00Z' }];
    expect(lastActivityAt('t1', events, overrides)).toBe('2026-03-01T00:00:00Z');
  });
});
