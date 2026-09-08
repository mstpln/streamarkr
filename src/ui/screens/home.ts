import { loadSnapshot, watchingNow, onHold, rateNow, resolveRateNowMedia, newSeason } from '../../lib/views.js';
import { posterStyle } from '../art.js';
import { navigate } from '../router.js';

let watchTab: 'watching' | 'onhold' = 'watching';
let rateTab: 'series' | 'movie' = 'series';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export async function render(el: HTMLElement) {
  el.innerHTML = `<div class="skeleton" style="height:220px;border-radius:16px;"></div>`;
  const snap = await loadSnapshot();
  const wn = watchingNow(snap);
  const oh = onHold(snap);
  const rnSeries = rateNow(snap, 'series');
  const rnMovies = rateNow(snap, 'movie');
  rateTab = resolveRateNowMedia(rateTab, rnSeries.length, rnMovies.length);
  const rn = rateTab === 'series' ? rnSeries : rnMovies;
  const hasRateNow = rnSeries.length > 0 || rnMovies.length > 0;
  const ns = newSeason(snap);

  el.innerHTML = `
    <div class="section">
      <div class="segmented" id="watch-seg">
        <button data-tab="watching" class="${watchTab === 'watching' ? 'active' : ''}">Watching Now (${wn.length})</button>
        <button data-tab="onhold" class="${watchTab === 'onhold' ? 'active' : ''}">On Hold (${oh.length})</button>
      </div>
      ${renderWatchingSection(watchTab === 'watching' ? wn : oh)}
    </div>

    ${hasRateNow ? `
    <div class="section" id="rate-now-section">
      <div class="section-title">Rate Now
        <span class="segmented" style="margin:0;padding:2px;width:auto;">
          <button data-rate-tab="series" class="${rateTab === 'series' ? 'active' : ''}" style="padding:6px 10px;">Series (${rnSeries.length})</button>
          <button data-rate-tab="movie" class="${rateTab === 'movie' ? 'active' : ''}" style="padding:6px 10px;">Movies (${rnMovies.length})</button>
        </span>
      </div>
      <div class="hscroll">
        ${rn.map((t) => posterCard(t.id, t.title, '')).join('')}
      </div>
    </div>` : ''}

    ${ns.length > 0 ? `
    <div class="section">
      <div class="section-title">New Season</div>
      <div class="hscroll">
        ${ns.map((c) => posterCard(c.title.id, c.title.title, c.releaseState === 'upcoming'
          ? `Season ${c.seasonNumber} upcoming${c.firstAirDate ? ' · ' + new Date(c.firstAirDate).toLocaleDateString() : ''}`
          : `Season ${c.seasonNumber} available`)).join('')}
      </div>
    </div>` : ''}
  `;

  el.querySelectorAll('#watch-seg button').forEach((b) =>
    b.addEventListener('click', () => { watchTab = (b as HTMLElement).dataset.tab as any; render(el); })
  );
  el.querySelectorAll('[data-rate-tab]').forEach((b) =>
    b.addEventListener('click', () => { rateTab = (b as HTMLElement).dataset.rateTab as any; render(el); })
  );
  el.querySelectorAll('[data-open]').forEach((c) =>
    c.addEventListener('click', () => navigate(`#/title/${(c as HTMLElement).dataset.open}`))
  );
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

function posterCard(id: string, title: string, sub: string) {
  return `
    <button type="button" class="poster-card poster-card-button" data-open="${id}" aria-label="Open ${escapeHtml(title)}">
      <div class="poster" style="${posterStyle(id)}"></div>
      <div class="card-title">${escapeHtml(title)}</div>
      ${sub ? `<div class="card-sub">${escapeHtml(sub)}</div>` : ''}
    </button>
  `;
}
