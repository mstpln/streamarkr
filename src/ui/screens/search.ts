import { TmdbAdapter, AvailabilityAdapter } from '../../lib/providers.js';
import * as repo from '../../lib/repo.js';
import { posterStyle } from '../art.js';
import { serviceLogoHtml } from '../logos.js';
import { navigate } from '../router.js';
import type { Title } from '../../lib/types.js';

let query = '';
let filter: 'all' | 'series' | 'movie' = 'all';
let debounceHandle: ReturnType<typeof setTimeout> | null = null;

export async function render(el: HTMLElement) {
  el.innerHTML = `
    <div class="page-title">Search</div>
    <div class="search-input-wrap">
      <label class="sr-only" for="search-box">Search series and movies</label>
      <input class="search-input" id="search-box" placeholder="Search series and movies…" value="${escapeAttr(query)}" />
    </div>
    <div class="pill-row">
      <button class="pill ${filter === 'all' ? 'active' : ''}" data-f="all">All</button>
      <button class="pill ${filter === 'series' ? 'active' : ''}" data-f="series">Series</button>
      <button class="pill ${filter === 'movie' ? 'active' : ''}" data-f="movie">Movies</button>
    </div>
    <div id="search-results"><div class="section-empty-hint">Type to search the catalogue.</div></div>
  `;

  const box = el.querySelector('#search-box') as HTMLInputElement;
  box.addEventListener('input', () => {
    query = box.value;
    if (debounceHandle) clearTimeout(debounceHandle);
    debounceHandle = setTimeout(() => runSearch(el), 320);
  });
  requestAnimationFrame(() => box.focus());
  el.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { filter = (b as HTMLElement).dataset.f as any; runSearch(el); }));

  if (query) runSearch(el);
}

async function runSearch(el: HTMLElement) {
  const results = el.querySelector('#search-results')!;
  el.querySelectorAll('[data-f]').forEach((b) => b.classList.toggle('active', (b as HTMLElement).dataset.f === filter));
  if (!query.trim()) { results.innerHTML = '<div class="section-empty-hint">Type to search the catalogue.</div>'; return; }
  results.innerHTML = `<div class="skeleton" style="height:200px;border-radius:14px;"></div>`;
  const currentQuery = query;

  // Fast path: TMDB-style basic results appear first, per section 4.2 — availability enriches
  // asynchronously afterward and must never block the initial render (Correction 4).
  const found = await TmdbAdapter.search(currentQuery);
  if (currentQuery !== query) return; // stale response
  const filtered = filter === 'all' ? found : found.filter((t) => t.mediaType === filter);
  if (filtered.length === 0) { results.innerHTML = '<div class="empty-state">No matches.</div>'; return; }
  const rows = await Promise.all(filtered.map(async (t) => ({ title: t, inLibrary: await repo.isInLibrary(t.id) })));
  if (currentQuery !== query) return;

  results.innerHTML = `<div class="row-list">
    ${rows.map(({ title, inLibrary }) => `
      <div class="row-item" data-open="${title.id}" role="link" tabindex="0" aria-label="Open ${title.title}">
        <div class="row-thumb" style="${posterStyle(title.id)}"></div>
        <div class="row-body">
          <div class="row-title">${title.title}</div>
          <div class="row-meta">${title.mediaType === 'series' ? 'Series' : 'Movie'} · ${title.year}</div>
          <div class="svc-logo-row" data-avail="${title.id}" aria-live="polite"></div>
        </div>
        <button class="heart-btn inline ${inLibrary ? 'active' : ''}" data-heart="${title.id}" aria-label="${inLibrary ? 'Remove from My Library' : 'Add to My Library'}" aria-pressed="${inLibrary}">♥</button>
      </div>
    `).join('')}
  </div>`;
  results.querySelectorAll('[data-open]').forEach((r) => r.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-heart]')) return;
    navigate(`#/title/${(r as HTMLElement).dataset.open}`);
  }));
  results.querySelectorAll('[data-open]').forEach((r) => r.addEventListener('keydown', (e) => {
    const event = e as KeyboardEvent;
    if (event.target !== r || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    navigate(`#/title/${(r as HTMLElement).dataset.open}`);
  }));
  results.querySelectorAll('[data-heart]').forEach((b) => b.addEventListener('click', async (e) => {
    e.stopPropagation();
    const btn = b as HTMLElement;
    const id = btn.dataset.heart!;
    const wasActive = btn.classList.contains('active');
    btn.classList.toggle('active');
    btn.setAttribute('aria-pressed', String(!wasActive));
    try {
      if (wasActive) await repo.removeFromLibrary(id); else await repo.addToLibrary(id);
    } catch {
      btn.classList.toggle('active'); // rollback on failure
      btn.setAttribute('aria-pressed', String(wasActive));
    }
  }));

  // Availability enrichment: fetch per-result, fake-async, and never held up the rows above.
  const services = await repo.allServices();
  const selectedKeys = new Set(services.filter((s) => s.userSelected).map((s) => s.serviceKey));
  for (const { title } of rows) {
    AvailabilityAdapter.getAvailability(title.id).then((availability) => {
      if (currentQuery !== query) return; // stale — a newer search has since replaced this DOM
      const slot = results.querySelector(`[data-avail="${title.id}"]`);
      if (!slot) return;
      const subs = availability.filter((a) => a.optionType === 'subscription').sort((a, b) => (selectedKeys.has(a.serviceKey) ? 0 : 1) - (selectedKeys.has(b.serviceKey) ? 0 : 1));
      slot.innerHTML = subs.length === 0
        ? '<span class="row-meta">Availability unknown</span>'
        : subs.map((a) => serviceLogoHtml(a.serviceKey, services.find((s) => s.serviceKey === a.serviceKey)?.displayName ?? a.serviceKey, 20)).join('');
    });
  }
}

function escapeAttr(s: string) {
  return s.replace(/"/g, '&quot;');
}
