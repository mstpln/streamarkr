import { loadSnapshot, libraryRows, genresOf, currentAvailability } from '../../lib/views.js';
import * as repo from '../../lib/repo.js';
import { posterStyle } from '../art.js';
import { serviceLogoHtml } from '../logos.js';
import { navigate } from '../router.js';

type SortKey = 'az' | 'added' | 'watched' | 'rating';
let mediaType: 'series' | 'movie' = 'series';
let sortKey: SortKey = 'az';
let genreFilter = '';
let serviceFilter = '';
let statusFilter = '';

export async function render(el: HTMLElement) {
  el.innerHTML = `<div class="skeleton" style="height:300px;border-radius:16px;"></div>`;
  const snap = await loadSnapshot();
  let rows = libraryRows(snap, mediaType);

  const genres = [...new Set(rows.flatMap((r) => genresOf(snap, r.title.id)))].sort();
  const services = snap.services.filter((s) => s.userSelected);
  const statuses = [...new Set(rows.map((r) => r.status))];

  if (genreFilter) rows = rows.filter((r) => genresOf(snap, r.title.id).includes(genreFilter));
  if (serviceFilter) rows = rows.filter((r) => currentAvailability(snap, r.title.id).some((a) => a.serviceKey === serviceFilter));
  if (statusFilter) rows = rows.filter((r) => r.status === statusFilter);

  rows = sortRows(rows, sortKey);

  el.innerHTML = `
    <div class="page-title">My Library</div>
    <div class="segmented">
      <button data-media="series" class="${mediaType === 'series' ? 'active' : ''}">Series</button>
      <button data-media="movie" class="${mediaType === 'movie' ? 'active' : ''}">Movies</button>
    </div>
    <div class="pill-row" id="sort-row">
      ${sortPill('az', 'A-Z')}${sortPill('added', 'Recently Added')}${sortPill('watched', 'Recently Watched')}${sortPill('rating', 'Highest Rated')}
    </div>
    <div class="pill-row" id="filter-row">
      ${selectPill('genre', 'Genre', genreFilter, genres)}
      ${selectPill('service', 'Service', serviceFilter, services.map((s) => s.displayName))}
      ${selectPill('status', 'Status', statusFilter, statuses)}
    </div>
    ${rows.length === 0 ? '<div class="empty-state">Nothing matches yet. Try Search to add titles.</div>' : `
    <div class="poster-grid">
      ${rows.map((r) => {
        // Correction 5: current availability only — never the historical "Where I watched it" field.
        const selectedKeys = new Set(services.map((s) => s.serviceKey));
        const subs = [...r.availability]
          .filter((a) => a.optionType === 'subscription')
          .sort((a, b) => (selectedKeys.has(a.serviceKey) ? 0 : 1) - (selectedKeys.has(b.serviceKey) ? 0 : 1))
          .slice(0, 3);
        return `
        <div class="poster-card" data-open="${r.title.id}" role="link" tabindex="0" aria-label="Open ${r.title.title}">
          <div class="poster" style="${posterStyle(r.title.id)}">
            <button class="heart-btn active" data-heart="${r.title.id}" aria-label="Remove from My Library" aria-pressed="true">♥</button>
            ${subs.length ? `<div class="poster-availability">${subs.map((a) => serviceLogoHtml(a.serviceKey, snap.services.find((s) => s.serviceKey === a.serviceKey)?.displayName ?? a.serviceKey, 20)).join('')}</div>` : ''}
          </div>
          <div class="card-title">${r.title.title}</div>
          <div class="card-sub">
            <span class="status-tag status-${r.status.replace(' ', '-')}">${r.status}</span>
            ${r.rating ? ` · ${'★'.repeat(r.rating)}` : ''}
          </div>
        </div>
      `;
      }).join('')}
    </div>`}
  `;

  el.querySelectorAll('[data-media]').forEach((b) => b.addEventListener('click', () => { mediaType = (b as HTMLElement).dataset.media as any; render(el); }));
  el.querySelectorAll('[data-sort]').forEach((b) => b.addEventListener('click', () => { sortKey = (b as HTMLElement).dataset.sort as SortKey; render(el); }));
  el.querySelectorAll('[data-open]').forEach((c) => c.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-heart]')) return;
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
    await repo.removeFromLibrary((b as HTMLElement).dataset.heart!);
    render(el);
  }));
  wireSelect(el, 'genre', (v) => { genreFilter = v; render(el); });
  wireSelect(el, 'service', (v) => { serviceFilter = services.find((s) => s.displayName === v)?.serviceKey ?? ''; render(el); });
  wireSelect(el, 'status', (v) => { statusFilter = v; render(el); });
}

function sortPill(key: SortKey, label: string) {
  return `<button class="pill ${sortKey === key ? 'active' : ''}" data-sort="${key}">${label}</button>`;
}

function selectPill(name: string, label: string, current: string, options: string[]) {
  return `
    <select class="pill" data-filter="${name}" style="appearance:none;">
      <option value="">${label}${current ? ` · ${current}` : ''}</option>
      ${options.map((o) => `<option value="${o}" ${o === current ? 'selected' : ''}>${o}</option>`).join('')}
    </select>
  `;
}

function wireSelect(el: HTMLElement, name: string, cb: (v: string) => void) {
  const sel = el.querySelector(`[data-filter="${name}"]`) as HTMLSelectElement | null;
  sel?.addEventListener('change', () => cb(sel.value));
}

function sortRows<T extends { title: { title: string }; addedAt: string; lastWatchedAt: string | null; rating?: number }>(rows: T[], key: SortKey): T[] {
  const copy = [...rows];
  switch (key) {
    case 'az': return copy.sort((a, b) => a.title.title.localeCompare(b.title.title));
    case 'added': return copy.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
    case 'rating': return copy.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    case 'watched': return copy.sort((a, b) => {
      if (a.lastWatchedAt && b.lastWatchedAt) return b.lastWatchedAt.localeCompare(a.lastWatchedAt);
      if (a.lastWatchedAt) return -1;
      if (b.lastWatchedAt) return 1;
      return a.title.title.localeCompare(b.title.title);
    });
  }
}
