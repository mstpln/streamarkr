import { loadSnapshot, historyRows, sortRecentlyWatched, genresOf } from '../../lib/views.js';
import { historicalServiceOptions } from '../../lib/service-options.js';
import { posterStyle } from '../art.js';
import { serviceLogoHtml } from '../logos.js';
import { navigate } from '../router.js';

let mediaType: 'series' | 'movie' = 'series';
let sortKey: 'az' | 'watched' = 'az';
let genreFilter = '';
let serviceFilter = '';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export async function render(el: HTMLElement) {
  el.innerHTML = `<div class="skeleton" style="height:300px;border-radius:16px;"></div>`;
  const snap = await loadSnapshot();
  const baseRows = historyRows(snap, mediaType);
  let rows = baseRows;
  const genres = [...new Set(baseRows.flatMap((r) => genresOf(snap, r.titleId)))].sort();
  const serviceOptions = historicalServiceOptions(baseRows, snap.services);

  if (genreFilter) rows = rows.filter((r) => genresOf(snap, r.titleId).includes(genreFilter));
  if (serviceFilter) rows = rows.filter((r) => r.watchedService === serviceFilter);

  const withNames = rows.map((r) => ({ ...r, titleName: r.title.title }));
  const sorted = sortKey === 'az'
    ? [...withNames].sort((a, b) => a.titleName.localeCompare(b.titleName))
    : sortRecentlyWatched(withNames);
  const activeServiceLabel = serviceOptions.find((option) => option.key === serviceFilter)?.label ?? serviceFilter;

  el.innerHTML = `
    <div class="page-title">History</div>
    <div class="segmented">
      <button data-media="series" class="${mediaType === 'series' ? 'active' : ''}">Series</button>
      <button data-media="movie" class="${mediaType === 'movie' ? 'active' : ''}">Movies</button>
    </div>
    <div class="pill-row">
      <button class="pill ${sortKey === 'az' ? 'active' : ''}" data-sort="az">A-Z</button>
      <button class="pill ${sortKey === 'watched' ? 'active' : ''}" data-sort="watched">Recently Watched</button>
    </div>
    <div class="pill-row">
      <select class="pill" data-filter="genre" aria-label="Filter History by genre"><option value="">Genre${genreFilter ? ' · ' + genreFilter : ''}</option>${genres.map((genre) => `<option value="${genre}" ${genre === genreFilter ? 'selected' : ''}>${genre}</option>`).join('')}</select>
      <select class="pill" data-filter="service" aria-label="Filter History by where I watched it"><option value="">Where I watched it${serviceFilter ? ' · ' + escapeHtml(activeServiceLabel) : ''}</option>${serviceOptions.map((option) => `<option value="${escapeHtml(option.key)}" ${option.key === serviceFilter ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}</select>
    </div>
    ${sorted.length === 0 ? '<div class="empty-state">No watch history yet.</div>' : `
    <div class="row-list">
      ${sorted.map((r) => {
        const serviceLabel = serviceOptions.find((option) => option.key === r.watchedService)?.label ?? r.watchedService;
        return `
        <button type="button" class="row-item row-button" data-open="${r.titleId}">
          <div class="row-thumb" style="${posterStyle(r.titleId)}"></div>
          <div class="row-body">
            <div class="row-title">${r.title.title}</div>
            <div class="row-meta">
              ${r.mediaType === 'series' ? `${r.watchedReleasedCount} of ${r.totalReleasedCount} episodes watched` : 'Movie'}
              ${r.lastWatchedAt ? ` · ${new Date(r.lastWatchedAt).toLocaleDateString()}` : ' · date unknown'}
            </div>
            ${r.watchedService ? `<div class="row-meta" style="display:flex;align-items:center;gap:6px;margin-top:3px;">${serviceLogoHtml(r.watchedService, serviceLabel ?? r.watchedService, 18)}<span>Watched on ${escapeHtml(serviceLabel ?? r.watchedService)}</span></div>` : ''}
          </div>
        </button>`;
      }).join('')}
    </div>`}
  `;

  el.querySelectorAll('[data-media]').forEach((button) => button.addEventListener('click', () => {
    mediaType = (button as HTMLElement).dataset.media as 'series' | 'movie';
    genreFilter = '';
    serviceFilter = '';
    render(el);
  }));
  el.querySelectorAll('[data-sort]').forEach((button) => button.addEventListener('click', () => { sortKey = (button as HTMLElement).dataset.sort as 'az' | 'watched'; render(el); }));
  (el.querySelector('[data-filter="genre"]') as HTMLSelectElement)?.addEventListener('change', (event) => { genreFilter = (event.target as HTMLSelectElement).value; render(el); });
  (el.querySelector('[data-filter="service"]') as HTMLSelectElement)?.addEventListener('change', (event) => { serviceFilter = (event.target as HTMLSelectElement).value; render(el); });
  el.querySelectorAll('[data-open]').forEach((row) => row.addEventListener('click', () => navigate(`#/title/${(row as HTMLElement).dataset.open}`)));
}
