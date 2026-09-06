import { loadSnapshot, historyRows, sortRecentlyWatched, genresOf } from '../../lib/views.js';
import { posterStyle } from '../art.js';
import { serviceLogoHtml } from '../logos.js';
import { navigate } from '../router.js';

let mediaType: 'series' | 'movie' = 'series';
let sortKey: 'az' | 'watched' = 'az';
let genreFilter = '';
let serviceFilter = '';

export async function render(el: HTMLElement) {
  el.innerHTML = `<div class="skeleton" style="height:300px;border-radius:16px;"></div>`;
  const snap = await loadSnapshot();
  let rows = historyRows(snap, mediaType);
  const genres = [...new Set(rows.flatMap((r) => genresOf(snap, r.titleId)))].sort();
  const services = snap.services.filter((s) => s.userSelected);

  if (genreFilter) rows = rows.filter((r) => genresOf(snap, r.titleId).includes(genreFilter));
  if (serviceFilter) rows = rows.filter((r) => r.watchedService === serviceFilter);

  const withNames = rows.map((r) => ({ ...r, titleName: r.title.title }));
  const sorted = sortKey === 'az'
    ? [...withNames].sort((a, b) => a.titleName.localeCompare(b.titleName))
    : sortRecentlyWatched(withNames);

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
      <select class="pill" data-filter="genre"><option value="">Genre${genreFilter ? ' · ' + genreFilter : ''}</option>${genres.map((g) => `<option value="${g}" ${g===genreFilter?'selected':''}>${g}</option>`).join('')}</select>
      <select class="pill" data-filter="service"><option value="">Where I watched it${serviceFilter ? ' · ' + (services.find(s=>s.serviceKey===serviceFilter)?.displayName ?? '') : ''}</option>${services.map((s) => `<option value="${s.serviceKey}" ${s.serviceKey===serviceFilter?'selected':''}>${s.displayName}</option>`).join('')}</select>
    </div>
    ${sorted.length === 0 ? '<div class="empty-state">No watch history yet.</div>' : `
    <div class="row-list">
      ${sorted.map((r) => `
        <button type="button" class="row-item row-button" data-open="${r.titleId}">
          <div class="row-thumb" style="${posterStyle(r.titleId)}"></div>
          <div class="row-body">
            <div class="row-title">${r.title.title}</div>
            <div class="row-meta">
              ${r.mediaType === 'series' ? `${r.watchedReleasedCount} of ${r.totalReleasedCount} episodes watched` : 'Movie'}
              ${r.lastWatchedAt ? ` · ${new Date(r.lastWatchedAt).toLocaleDateString()}` : ' · date unknown'}
            </div>
            ${r.watchedService ? `<div class="row-meta" style="display:flex;align-items:center;gap:6px;margin-top:3px;">${serviceLogoHtml(r.watchedService, services.find((s) => s.serviceKey === r.watchedService)?.displayName ?? r.watchedService, 18)}<span>Watched on ${services.find((s) => s.serviceKey === r.watchedService)?.displayName ?? r.watchedService}</span></div>` : ''}
          </div>
        </button>
      `).join('')}
    </div>`}
  `;

  el.querySelectorAll('[data-media]').forEach((b) => b.addEventListener('click', () => { mediaType = (b as HTMLElement).dataset.media as any; render(el); }));
  el.querySelectorAll('[data-sort]').forEach((b) => b.addEventListener('click', () => { sortKey = (b as HTMLElement).dataset.sort as any; render(el); }));
  (el.querySelector('[data-filter="genre"]') as HTMLSelectElement)?.addEventListener('change', (e) => { genreFilter = (e.target as HTMLSelectElement).value; render(el); });
  (el.querySelector('[data-filter="service"]') as HTMLSelectElement)?.addEventListener('change', (e) => { serviceFilter = (e.target as HTMLSelectElement).value; render(el); });
  el.querySelectorAll('[data-open]').forEach((r) => r.addEventListener('click', () => navigate(`#/title/${(r as HTMLElement).dataset.open}`)));
}
