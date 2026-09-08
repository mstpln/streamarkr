import { loadSnapshot, libraryRows, genresOf, currentAvailability } from '../../lib/views.js';
import { availabilityServiceOptions, type ServiceOption } from '../../lib/service-options.js';
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

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export async function render(el: HTMLElement) {
  el.innerHTML = `<div class="skeleton" style="height:300px;border-radius:16px;"></div>`;
  const snap = await loadSnapshot();
  const baseRows = libraryRows(snap, mediaType);
  let rows = baseRows;

  const genres = [...new Set(baseRows.flatMap((r) => genresOf(snap, r.title.id)))].sort();
  const serviceOptions = availabilityServiceOptions(baseRows, snap.services);
  const statuses = [...new Set(baseRows.map((r) => r.status))];

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
      ${selectPill('genre', 'Genre', genreFilter, genres.map((genre) => ({ key: genre, label: genre })))}
      ${selectPill('service', 'Service', serviceFilter, serviceOptions)}
      ${selectPill('status', 'Status', statusFilter, statuses.map((status) => ({ key: status, label: status })))}
    </div>
    ${rows.length === 0 ? '<div class="empty-state">Nothing matches yet. Try Search to add titles.</div>' : `
    <div class="poster-grid">
      ${rows.map((r) => {
        const selectedKeys = new Set(snap.services.filter((service) => service.userSelected).map((service) => service.serviceKey));
        const subs = [...r.availability]
          .filter((a) => a.optionType === 'subscription')
          .sort((a, b) => (selectedKeys.has(a.serviceKey) ? 0 : 1) - (selectedKeys.has(b.serviceKey) ? 0 : 1))
          .slice(0, 3);
        return `
        <div class="poster-card" data-open="${r.title.id}" role="link" tabindex="0" aria-label="Open ${escapeHtml(r.title.title)}">
          <div class="poster" style="${posterStyle(r.title.id)}">
            <button class="heart-btn active" data-heart="${r.title.id}" aria-label="Remove from My Library" aria-pressed="true">♥</button>
            ${subs.length ? `<div class="poster-availability">${subs.map((a) => serviceLogoHtml(a.serviceKey, snap.services.find((service) => service.serviceKey === a.serviceKey)?.displayName ?? a.serviceKey, 20)).join('')}</div>` : ''}
          </div>
          <div class="card-title">${escapeHtml(r.title.title)}</div>
          <div class="card-sub">
            <span class="status-tag status-${r.status.replace(' ', '-')}">${escapeHtml(r.status)}</span>
            ${r.rating ? ` · ${'★'.repeat(r.rating)}` : ''}
          </div>
        </div>
      `;
      }).join('')}
    </div>`}
  `;

  el.querySelectorAll('[data-media]').forEach((button) => button.addEventListener('click', () => {
    mediaType = (button as HTMLElement).dataset.media as 'series' | 'movie';
    genreFilter = '';
    serviceFilter = '';
    statusFilter = '';
    render(el);
  }));
  el.querySelectorAll('[data-sort]').forEach((button) => button.addEventListener('click', () => { sortKey = (button as HTMLElement).dataset.sort as SortKey; render(el); }));
  el.querySelectorAll('[data-open]').forEach((card) => card.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).closest('[data-heart]')) return;
    navigate(`#/title/${(card as HTMLElement).dataset.open}`);
  }));
  el.querySelectorAll('[data-open]').forEach((card) => card.addEventListener('keydown', (event) => {
    const keyEvent = event as KeyboardEvent;
    if (keyEvent.target !== card || !['Enter', ' '].includes(keyEvent.key)) return;
    keyEvent.preventDefault();
    navigate(`#/title/${(card as HTMLElement).dataset.open}`);
  }));
  el.querySelectorAll('[data-heart]').forEach((button) => button.addEventListener('click', async (event) => {
    event.stopPropagation();
    await repo.removeFromLibrary((button as HTMLElement).dataset.heart!);
    render(el);
  }));
  wireSelect(el, 'genre', (value) => { genreFilter = value; render(el); });
  wireSelect(el, 'service', (value) => { serviceFilter = value; render(el); });
  wireSelect(el, 'status', (value) => { statusFilter = value; render(el); });
}

function sortPill(key: SortKey, label: string) {
  return `<button class="pill ${sortKey === key ? 'active' : ''}" data-sort="${key}">${label}</button>`;
}

function selectPill(name: string, label: string, current: string, options: ServiceOption[]) {
  const activeLabel = options.find((option) => option.key === current)?.label ?? current;
  return `
    <select class="pill" data-filter="${name}" aria-label="Filter My Library by ${label.toLowerCase()}" style="appearance:none;">
      <option value="">${label}${current ? ` · ${escapeHtml(activeLabel)}` : ''}</option>
      ${options.map((option) => `<option value="${escapeHtml(option.key)}" ${option.key === current ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
    </select>
  `;
}

function wireSelect(el: HTMLElement, name: string, cb: (value: string) => void) {
  const select = el.querySelector(`[data-filter="${name}"]`) as HTMLSelectElement | null;
  select?.addEventListener('change', () => cb(select.value));
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
