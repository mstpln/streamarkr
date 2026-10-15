import { loadSnapshot, watchingNow, onHold, rateNow, newSeason, newMovieReleases, titleStatus } from '../../lib/views.js';
import { posterStyle } from '../art.js';
import { navigate } from '../router.js';
import type { MediaType, Title } from '../../lib/types.js';

type SeriesStatusTab = 'watching' | 'onhold';
type MovieStatusTab = 'to-watch' | 'watched';

let mediaTab: MediaType = 'series';
let seriesStatusTab: SeriesStatusTab = 'watching';
let movieStatusTab: MovieStatusTab = 'to-watch';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export async function render(el: HTMLElement) {
  el.innerHTML = `<div class="skeleton" style="height:220px;border-radius:16px;"></div>`;
  const snap = await loadSnapshot();
  const libraryTitles = snap.library
    .map((item) => snap.titles.find((title) => title.id === item.titleId))
    .filter((title): title is Title => !!title);
  const seriesLibrary = libraryTitles.filter((title) => title.mediaType === 'series');
  const movieLibrary = libraryTitles.filter((title) => title.mediaType === 'movie');
  const seriesWatching = watchingNow(snap);
  const seriesOnHold = onHold(snap);
  const moviesToWatch = movieLibrary.filter((title) => titleStatus(snap, title.id) === 'To Watch');
  const moviesWatched = movieLibrary.filter((title) => titleStatus(snap, title.id) === 'Finished');
  const rateItems = rateNow(snap, mediaTab);
  const seasons = mediaTab === 'series' ? newSeason(snap) : [];
  const releases = mediaTab === 'movie' ? newMovieReleases(snap) : [];
  const statusOptions = mediaTab === 'series'
    ? [
        { key: 'watching', label: 'Watching Now', count: seriesWatching.length, active: seriesStatusTab === 'watching' },
        { key: 'onhold', label: 'On Hold', count: seriesOnHold.length, active: seriesStatusTab === 'onhold' }
      ]
    : [
        { key: 'to-watch', label: 'To Watch', count: moviesToWatch.length, active: movieStatusTab === 'to-watch' },
        { key: 'watched', label: 'Watched', count: moviesWatched.length, active: movieStatusTab === 'watched' }
      ];
  const selectedStatusContent = mediaTab === 'series'
    ? renderWatchingSection(seriesStatusTab === 'watching' ? seriesWatching : seriesOnHold)
    : renderMovieSection(
        movieStatusTab === 'to-watch' ? moviesToWatch : moviesWatched,
        movieStatusTab === 'to-watch' ? 'To Watch' : 'Watched'
      );
  const updateSection = mediaTab === 'series'
    ? seasons.length > 0 ? `
      <div class="section">
        <div class="section-title">New Seasons</div>
        <div class="hscroll">
          ${seasons.map((season) => posterCard(season.title.id, season.title.title, season.releaseState === 'upcoming'
            ? `Season ${season.seasonNumber} upcoming${season.firstAirDate ? ' · ' + new Date(season.firstAirDate).toLocaleDateString() : ''}`
            : `Season ${season.seasonNumber} available`)).join('')}
        </div>
      </div>` : ''
    : releases.length > 0 ? `
      <div class="section">
        <div class="section-title">New Releases</div>
        <div class="hscroll">
          ${releases.map((release) => posterCard(
            release.title.id,
            release.title.title,
            `${release.releaseState === 'upcoming' ? 'Releases' : 'Released'} ${formatReleaseDate(release.releaseDate)}`
          )).join('')}
        </div>
      </div>` : '';

  el.innerHTML = `
    <div class="home-filter-stack">
      <div class="segmented home-media-switch" role="group" aria-label="Choose media type">
        <button type="button" data-media-tab="series" class="${mediaTab === 'series' ? 'active' : ''}" aria-pressed="${mediaTab === 'series'}">
          Series <span class="home-filter-count">${seriesLibrary.length}</span>
        </button>
        <button type="button" data-media-tab="movie" class="${mediaTab === 'movie' ? 'active' : ''}" aria-pressed="${mediaTab === 'movie'}">
          Movies <span class="home-filter-count">${movieLibrary.length}</span>
        </button>
      </div>
      <div class="home-status-switch" role="group" aria-label="${mediaTab === 'series' ? 'Filter series by status' : 'Filter movies by status'}">
        ${statusOptions.map((option) => `
          <button type="button" data-home-status="${option.key}" class="${option.active ? 'active' : ''}" aria-pressed="${option.active}">
            ${option.label} <span class="home-status-count">(${option.count})</span>
          </button>
        `).join('')}
      </div>
    </div>
    <div class="section home-current-section">${selectedStatusContent}</div>

    ${rateItems.length > 0 ? `
    <div class="section" id="rate-now-section">
      <div class="section-title">Rate Now</div>
      <div class="hscroll">
        ${rateItems.map((title) => posterCard(title.id, title.title, '')).join('')}
      </div>
    </div>` : ''}

    ${updateSection}
  `;

  el.querySelectorAll('[data-media-tab]').forEach((button) =>
    button.addEventListener('click', () => {
      mediaTab = (button as HTMLElement).dataset.mediaTab as MediaType;
      render(el);
    })
  );
  el.querySelectorAll('[data-home-status]').forEach((button) =>
    button.addEventListener('click', () => {
      const status = (button as HTMLElement).dataset.homeStatus;
      if (mediaTab === 'series' && (status === 'watching' || status === 'onhold')) seriesStatusTab = status;
      if (mediaTab === 'movie' && (status === 'to-watch' || status === 'watched')) movieStatusTab = status;
      render(el);
    })
  );
  el.querySelectorAll('[data-open]').forEach((c) =>
    c.addEventListener('click', () => navigate(`#/title/${(c as HTMLElement).dataset.open}`))
  );
}

function formatReleaseDate(releaseDate: string): string {
  return new Date(`${releaseDate}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function renderWatchingSection(items: ReturnType<typeof import('../../lib/views').watchingNow>) {
  if (items.length === 0) {
    return `<div class="section-empty-hint">Nothing here right now.</div>`;
  }
  return `<div class="hscroll">
    ${items.map((c) => `
      <button type="button" class="poster-card poster-card-button" data-open="${c.title.id}" aria-label="Open ${escapeHtml(c.title.title)}">
        <div class="poster" style="${posterStyle(c.title.id)}">
          <div class="poster-overlay">S${c.seasonNumber} · E${c.watchedInSeason} of ${c.totalInSeason}</div>
          <div class="poster-progress"><div style="width:${c.totalInSeason ? Math.round((c.watchedInSeason / c.totalInSeason) * 100) : 0}%"></div></div>
        </div>
        <div class="card-title">${escapeHtml(c.title.title)}</div>
        <div class="card-sub"><span class="status-tag status-${c.status.replace(' ', '-')}">${escapeHtml(c.status)}</span></div>
      </button>
    `).join('')}
  </div>`;
}

function renderMovieSection(items: Title[], status: 'To Watch' | 'Watched') {
  if (items.length === 0) {
    return `<div class="section-empty-hint">${status === 'To Watch' ? 'No movies to watch right now.' : 'No watched movies in My Library yet.'}</div>`;
  }
  return `<div class="hscroll">
    ${items.map((title) => posterCard(title.id, title.title, status)).join('')}
  </div>`;
}

function posterCard(id: string, title: string, sub: string) {
  return `
    <button type="button" class="poster-card poster-card-button" data-open="${id}" aria-label="Open ${escapeHtml(title)}">
      <div class="poster" style="${posterStyle(id)}"></div>
      <div class="card-title">${escapeHtml(title)}</div>
      ${sub ? `<div class="card-sub">${escapeHtml(sub)}</div>` : ''}
    </button>
  `;
}
