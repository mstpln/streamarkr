import { loadSnapshot, discoverContext, libraryRows, Discover } from '../../lib/views.js';
import * as repo from '../../lib/repo.js';
import { posterStyle } from '../art.js';
import { serviceLogoHtml } from '../logos.js';
import { openTrailer } from '../trailer.js';
import { navigate } from '../router.js';
import type { DiscoverCard } from '../../lib/discover.js';

type View = 'top' | 'similar' | 'genre';
let view: View = 'top';
let mediaType: 'series' | 'movie' = 'series';
let similarSeed = '';
let genre = '';

export async function render(el: HTMLElement) {
  el.innerHTML = `<div class="skeleton" style="height:300px;border-radius:16px;"></div>`;
  const snap = await loadSnapshot();
  const ctx = discoverContext(snap);
  const selectedKeys = new Set(snap.services.filter((s) => s.userSelected).map((s) => s.serviceKey));

  let cards: DiscoverCard[] = [];
  const libraryTitles = libraryRows(snap, mediaType).map((r) => r.title);
  const genres = Discover.allGenres(ctx, mediaType);
  if (!genre && genres.length) genre = genres[0];
  if (!similarSeed && libraryTitles.length) similarSeed = libraryTitles[0].id;

  if (view === 'top') cards = Discover.topPicks(mediaType, ctx);
  else if (view === 'similar' && similarSeed) cards = Discover.similarTo(similarSeed, ctx);
  else if (view === 'genre' && genre) cards = Discover.byGenre(mediaType, genre, ctx);

  el.innerHTML = `
    <div class="page-title">Discover</div>
    <div class="pill-row">
      <button class="pill ${view === 'top' ? 'active' : ''}" data-view="top">Based on My Top Picks</button>
      <button class="pill ${view === 'similar' ? 'active' : ''}" data-view="similar">Similar To</button>
      <button class="pill ${view === 'genre' ? 'active' : ''}" data-view="genre">By Genre</button>
    </div>
    <div class="segmented">
      <button data-media="series" class="${mediaType === 'series' ? 'active' : ''}">Series</button>
      <button data-media="movie" class="${mediaType === 'movie' ? 'active' : ''}">Movies</button>
    </div>
    ${view === 'similar' ? `
      <label class="sr-only" for="seed-select">Similar to</label>
      <select class="pill" id="seed-select" style="margin-bottom:14px;width:100%;">
        ${libraryTitles.map((t) => `<option value="${t.id}" ${t.id === similarSeed ? 'selected' : ''}>${t.title}</option>`).join('') || '<option>Add titles to My Library first</option>'}
      </select>` : ''}
    ${view === 'genre' ? `
      <label class="sr-only" for="genre-select">Genre</label>
      <select class="pill" id="genre-select" style="margin-bottom:14px;width:100%;">
        ${genres.map((g) => `<option value="${g}" ${g === genre ? 'selected' : ''}>${g}</option>`).join('') || '<option>No genres yet</option>'}
      </select>` : ''}
    ${cards.length === 0 ? '<div class="empty-state">No eligible recommendations yet — add more titles to My Library or select more streaming services in Preferences.</div>' : `
    <div class="poster-grid">
      ${cards.map((c) => {
        const subs = [...c.availability]
          .sort((a, b) => (selectedKeys.has(a.serviceKey) ? 0 : 1) - (selectedKeys.has(b.serviceKey) ? 0 : 1))
          .slice(0, 3);
        return `
        <div class="poster-card" data-open="${c.title.id}" role="link" tabindex="0" aria-label="Open ${c.title.title}">
          <div class="poster" style="${posterStyle(c.title.id)}">
            <button class="heart-btn" data-heart="${c.title.id}" aria-label="Add to My Library" aria-pressed="false">♥</button>
            ${subs.length ? `<div class="poster-availability">${subs.map((a) => serviceLogoHtml(a.serviceKey, snap.services.find((s) => s.serviceKey === a.serviceKey)?.displayName ?? a.serviceKey, 20)).join('')}</div>` : ''}
            ${c.trailerKey ? `<button class="icon-btn" data-trailer="${c.title.id}" aria-label="Watch trailer" style="position:absolute;right:6px;bottom:6px;background:rgba(0,0,0,0.55);">▶</button>` : ''}
          </div>
          <div class="card-title">${c.title.title}</div>
          <div class="card-sub">${c.mediaType === 'series' ? 'Series' : 'Movie'} · ${c.genres[0] ?? '—'} · ${c.year}</div>
          <div class="card-sub" style="opacity:0.75;">${c.why}</div>
        </div>
      `;
      }).join('')}
    </div>`}
  `;

  el.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => { view = (b as HTMLElement).dataset.view as View; render(el); }));
  el.querySelectorAll('[data-media]').forEach((b) => b.addEventListener('click', () => { mediaType = (b as HTMLElement).dataset.media as any; similarSeed = ''; genre = ''; render(el); }));
  el.querySelector('#seed-select')?.addEventListener('change', (e) => { similarSeed = (e.target as HTMLSelectElement).value; render(el); });
  el.querySelector('#genre-select')?.addEventListener('change', (e) => { genre = (e.target as HTMLSelectElement).value; render(el); });
  el.querySelectorAll('[data-open]').forEach((c) => c.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-heart]') || (e.target as HTMLElement).closest('[data-trailer]')) return;
    navigate(`#/title/${(c as HTMLElement).dataset.open}`);
  }));
  el.querySelectorAll('[data-open]').forEach((c) => c.addEventListener('keydown', (e) => {
    const event = e as KeyboardEvent;
    if (event.target !== c || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    navigate(`#/title/${(c as HTMLElement).dataset.open}`);
  }));
  el.querySelectorAll('[data-heart]').forEach((b) => b.addEventListener('click', async (e) => {
    e.stopPropagation();
    const titleId = (b as HTMLElement).dataset.heart!;
    try {
      await repo.addToLibrary(titleId);
      // Discover excludes My Library by definition. Re-render immediately so the newly-added title
      // disappears instead of leaving behind a misleading active heart that looks removable here.
      await render(el);
    } catch {
      // No local title record for this id (shouldn't happen with fixture data, but repo.ts
      // guards against creating a dangling Library membership either way) — leave the card as-is.
    }
  }));
  el.querySelectorAll('[data-trailer]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const btn = b as HTMLElement;
    const titleId = btn.dataset.trailer!;
    const card = cards.find((c) => c.title.id === titleId);
    if (card) openTrailer(card.trailerKey, card.title.title);
  }));
}
