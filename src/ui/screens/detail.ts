import * as repo from '../../lib/repo.js';
import { resolveEpisode, resolveMovie } from '../../lib/resolve.js';
import { computeRelevantSeason } from '../../lib/season-select.js';
import { choosePrimaryStreamingAction } from '../../lib/streaming.js';
import { posterStyle, backdropStyle } from '../art.js';
import { serviceLogoHtml } from '../logos.js';
import { openTrailer } from '../trailer.js';
import type { Episode, ServiceDef, WatchEvent, WatchOverride } from '../../lib/types.js';

type Tab = 'overview' | 'episodes' | 'streaming' | 'history';
let tab: Tab = 'overview';
let activeSeason: number | null = null;
let currentId = '';

export async function render(el: HTMLElement, id: string) {
  if (id !== currentId) { tab = 'overview'; activeSeason = null; currentId = id; }
  el.innerHTML = `<div class="skeleton" style="height:400px;border-radius:16px;margin:-14px -14px 0;"></div>`;
  const bundle = await repo.getTitleBundle(id);
  if (!bundle) { el.innerHTML = '<div class="empty-state">Title not found.</div>'; return; }
  const { title, metadata, seasons, episodes, events, overrides, library, rating, availability, status } = bundle;
  const services = await repo.allServices();
  const inLibrary = !!library;

  if (title.mediaType === 'series' && activeSeason === null) {
    activeSeason = computeRelevantSeason(id, seasons, episodes, events, overrides) ?? seasons[0]?.seasonNumber ?? 1;
  }

  const tabs: Tab[] = title.mediaType === 'series' ? ['overview', 'episodes', 'streaming', 'history'] : ['overview', 'streaming', 'history'];
  const primary = choosePrimaryStreamingAction(availability, services);
  const primaryService: ServiceDef | undefined = primary ? services.find((service) => service.serviceKey === primary.serviceKey) : undefined;

  el.innerHTML = `
    <div class="detail-hero" style="${backdropStyle(id + 'bd')}"></div>
    <div class="detail-head">
      <div class="detail-poster" style="${posterStyle(id)}"></div>
      <div style="padding-top:70px;">
        <div class="detail-title">${title.title}</div>
        <div class="detail-meta">${title.mediaType === 'series' ? 'Series' : 'Movie'} · ${title.year} · <span class="status-tag status-${status.replace(' ', '-')}">${status}</span></div>
      </div>
    </div>
    ${primary ? `
    <button type="button" class="primary-stream-action" id="primary-stream-btn">
      ${serviceLogoHtml(primary.serviceKey, primaryService?.displayName ?? primary.serviceKey, 24)}
      <span>Open in ${primaryService?.displayName ?? primary.serviceKey}</span>
    </button>` : ''}
    <div class="action-row">
      <button type="button" class="action-btn ${inLibrary ? 'active' : ''}" id="heart-btn" aria-pressed="${inLibrary}" aria-label="${inLibrary ? 'Remove from My Library' : 'Add to My Library'}">♥ ${inLibrary ? 'In Library' : 'Add to Library'}</button>
      <button type="button" class="action-btn" id="trailer-btn" ${metadata?.trailerKey ? '' : 'disabled style="opacity:0.5;" aria-disabled="true"'} aria-label="Watch trailer">▶ Watch trailer</button>
      ${title.mediaType === 'movie' ? `<button type="button" class="action-btn ${status === 'Finished' ? 'active' : ''}" id="movie-watched-btn" aria-pressed="${status === 'Finished'}">${status === 'Finished' ? '✓ Watched' : 'Mark watched'}</button>` : ''}
    </div>
    <div class="action-row rating-row" style="margin-top:-10px;">
      <div class="stars" id="stars" role="group" aria-label="Rating">
        ${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="star ${rating && n <= rating.stars ? 'filled' : ''}" data-star="${n}" aria-label="Rate ${n} star${n === 1 ? '' : 's'}" aria-pressed="${rating?.stars === n}">★</button>`).join('')}
      </div>
    </div>

    <div class="tabs" role="tablist" aria-label="Title details">
      ${tabs.map((name) => `<button type="button" class="tab-btn ${tab === name ? 'active' : ''}" data-tab="${name}" role="tab" aria-selected="${tab === name}">${name[0].toUpperCase() + name.slice(1)}</button>`).join('')}
    </div>
    <div id="tab-body"></div>
  `;

  el.querySelector('#heart-btn')!.addEventListener('click', async () => {
    if (inLibrary) await repo.removeFromLibrary(id); else await repo.addToLibrary(id);
    await render(el, id);
  });
  el.querySelector('#trailer-btn')?.addEventListener('click', () => openTrailer(metadata?.trailerKey, title.title));
  el.querySelector('#primary-stream-btn')?.addEventListener('click', () => {
    if (primary?.deepLink) window.open(primary.deepLink, '_blank', 'noopener,noreferrer');
  });
  el.querySelector('#movie-watched-btn')?.addEventListener('click', async () => {
    await repo.setMovieOverride(id, status === 'Finished' ? 'unwatched' : 'watched');
    await render(el, id);
  });
  el.querySelectorAll('[data-star]').forEach((star) => star.addEventListener('click', async () => {
    await repo.setRating(id, Number((star as HTMLElement).dataset.star) as 1 | 2 | 3 | 4 | 5);
    await render(el, id);
  }));
  el.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => {
    tab = (button as HTMLElement).dataset.tab as Tab;
    renderTab(el, bundle, services);
  }));

  renderTab(el, bundle, services);
}

function renderTab(
  el: HTMLElement,
  bundle: Awaited<ReturnType<typeof repo.getTitleBundle>>,
  services: Awaited<ReturnType<typeof repo.allServices>>
) {
  el.querySelectorAll('[data-tab]').forEach((button) => {
    const selected = (button as HTMLElement).dataset.tab === tab;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-selected', String(selected));
  });
  const body = el.querySelector('#tab-body')!;
  if (!bundle) return;
  const { title, metadata, seasons, episodes, events, overrides, watchedService, availability } = bundle;

  if (tab === 'overview') {
    const now = new Date();
    let progressRows = '';
    if (title.mediaType === 'series') {
      const released = episodes
        .filter((episode) => episode.airDate && new Date(episode.airDate) <= now)
        .sort(compareEpisode);
      const watchedReleased = released.filter((episode) => resolveEpisode(title.id, episode.seasonNumber, episode.episodeNumber, events, overrides).watched);
      const nextAvailable = released.find((episode) => !resolveEpisode(title.id, episode.seasonNumber, episode.episodeNumber, events, overrides).watched) ?? null;
      const nextUpcoming = episodes
        .filter((episode) => episode.airDate && new Date(episode.airDate) > now)
        .sort((a, b) => new Date(a.airDate!).getTime() - new Date(b.airDate!).getTime())[0] ?? null;
      const futureSeason = [...seasons]
        .filter((season) => season.seasonNumber >= 2 && (!season.airDate || new Date(season.airDate) > now))
        .sort((a, b) => {
          if (!a.airDate && !b.airDate) return a.seasonNumber - b.seasonNumber;
          if (!a.airDate) return 1;
          if (!b.airDate) return -1;
          return new Date(a.airDate).getTime() - new Date(b.airDate).getTime();
        })[0] ?? null;

      progressRows = `
        <div class="card-row"><span>Progress</span><span>${watchedReleased.length} of ${released.length} released episodes watched</span></div>
        ${nextAvailable ? `<div class="card-row"><span>Next available</span><span>S${nextAvailable.seasonNumber} E${nextAvailable.episodeNumber} · ${nextAvailable.name}</span></div>` : ''}
        ${nextUpcoming ? `<div class="card-row"><span>Next upcoming</span><span>S${nextUpcoming.seasonNumber} E${nextUpcoming.episodeNumber} · ${formatDate(nextUpcoming.airDate)}</span></div>` : ''}
        ${futureSeason ? `<div class="card-row"><span>Future season</span><span>Season ${futureSeason.seasonNumber}${futureSeason.airDate ? ` · ${formatDate(futureSeason.airDate)}` : ' · Date TBA'}</span></div>` : ''}
      `;
    } else if (metadata?.releaseDate) {
      progressRows = `<div class="card-row"><span>Release date</span><span>${formatDate(metadata.releaseDate)}</span></div>`;
    }

    body.innerHTML = `
      <p class="detail-overview">${metadata?.overview ?? 'No synopsis available.'}</p>
      <div class="card-row"><span>Genres</span><span>${(metadata?.genres ?? []).join(', ') || '—'}</span></div>
      ${title.mediaType === 'series' ? `<div class="card-row"><span>Series status</span><span>${metadata?.status ?? 'Unknown'}</span></div>` : ''}
      ${progressRows}
      <div class="card-row">
        <span>Where I watched it</span>
        <select id="watched-service-select" aria-label="Where I watched it">
          <option value="">Not set</option>
          ${services.filter((service) => service.userSelected).map((service) => `<option value="${service.serviceKey}" ${watchedService?.serviceKey === service.serviceKey ? 'selected' : ''}>${service.displayName}</option>`).join('')}
        </select>
      </div>
    `;
    body.querySelector('#watched-service-select')?.addEventListener('change', async (event) => {
      const value = (event.target as HTMLSelectElement).value;
      await repo.setWatchedService(title.id, value || null);
    });
  } else if (tab === 'episodes' && title.mediaType === 'series') {
    body.innerHTML = `
      <div class="pill-row season-pills" role="tablist" aria-label="Seasons">
        ${[...seasons].sort((a, b) => a.seasonNumber - b.seasonNumber).map((season) => `<button type="button" class="pill ${activeSeason === season.seasonNumber ? 'active' : ''}" data-season="${season.seasonNumber}" role="tab" aria-selected="${activeSeason === season.seasonNumber}">${season.name}</button>`).join('')}
      </div>
      <div id="episode-list"></div>
    `;
    body.querySelectorAll('[data-season]').forEach((button) => button.addEventListener('click', () => {
      activeSeason = Number((button as HTMLElement).dataset.season);
      renderTab(el, bundle, services);
    }));
    renderEpisodeList(body, title.id, episodes, events, overrides);
  } else if (tab === 'streaming') {
    const selectedKeys = new Set(services.filter((service) => service.userSelected).map((service) => service.serviceKey));
    const sorted = [...availability].sort((a, b) => (selectedKeys.has(a.serviceKey) ? 0 : 1) - (selectedKeys.has(b.serviceKey) ? 0 : 1));
    body.innerHTML = sorted.length === 0
      ? '<div class="section-empty-hint">Availability unknown.</div>'
      : `<div class="row-list">
        ${sorted.map((entry) => {
          const service = services.find((item) => item.serviceKey === entry.serviceKey);
          const daysLeft = entry.endsAt ? (new Date(entry.endsAt).getTime() - Date.now()) / 86400000 : null;
          const leavingSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 30;
          return `<div class="row-item static-row">
            ${serviceLogoHtml(entry.serviceKey, service?.displayName ?? entry.serviceKey, 32)}
            <div class="row-body">
              <div class="row-title">${service?.displayName ?? entry.serviceKey}</div>
              <div class="row-meta">${entry.optionType === 'subscription' ? 'Included with subscription' : entry.optionType}${leavingSoon ? ` · Leaving ${formatDate(entry.endsAt)}` : ''}</div>
            </div>
            ${entry.deepLink ? `<a href="${entry.deepLink}" target="_blank" rel="noopener noreferrer" class="action-btn" style="text-decoration:none;">Open</a>` : ''}
          </div>`;
        }).join('')}
      </div>`;
  } else if (tab === 'history') {
    renderHistoryTab(body, title.id, title.mediaType, events, overrides);
  }
}

function renderHistoryTab(body: Element, titleId: string, mediaType: 'series' | 'movie', events: WatchEvent[], overrides: WatchOverride[]) {
  const providerEvents = events.filter((event) => event.titleId === titleId).sort((a, b) => b.watchedAt.localeCompare(a.watchedAt));
  const manual = overrides.filter((override) => override.titleId === titleId).sort((a, b) => b.changedAt.localeCompare(a.changedAt));

  body.innerHTML = `
    <div class="detail-history-section">
      <div class="section-title">Watch history</div>
      ${providerEvents.length === 0 ? '<div class="section-empty-hint">No provider watch events recorded.</div>' : `
        <div class="row-list">
          ${providerEvents.map((event) => `<div class="row-item static-row">
            <div class="row-body">
              <div class="row-title">${mediaType === 'movie' ? 'Watched' : `S${event.seasonNumber} · E${event.episodeNumber}`}</div>
              <div class="row-meta">${formatDate(event.watchedAt)}</div>
            </div>
          </div>`).join('')}
        </div>`}
    </div>
    <div class="detail-history-section">
      <div class="section-title">Manual corrections</div>
      ${manual.length === 0 ? '<div class="section-empty-hint">No manual corrections.</div>' : `
        <div class="row-list">
          ${manual.map((override) => `<div class="row-item static-row">
            <div class="row-body">
              <div class="row-title">${overrideLabel(override)}</div>
              <div class="row-meta">Corrected ${formatDate(override.changedAt)} · ${override.state === 'watched' ? 'Watched' : 'Unwatched'}</div>
            </div>
          </div>`).join('')}
        </div>`}
    </div>
  `;
}

function renderEpisodeList(body: Element, titleId: string, episodes: Episode[], events: WatchEvent[], overrides: WatchOverride[]) {
  const list = body.querySelector('#episode-list')!;
  const eps = episodes.filter((episode) => episode.seasonNumber === activeSeason).sort((a, b) => a.episodeNumber - b.episodeNumber);
  const now = new Date();
  const releasedCount = eps.filter((episode) => episode.airDate && new Date(episode.airDate) <= now).length;
  list.innerHTML = `
    <div class="season-bulk-actions">
      <button type="button" class="action-btn" id="season-watched" ${releasedCount === 0 ? 'disabled aria-disabled="true"' : ''}>Mark season watched</button>
      <button type="button" class="action-btn" id="season-unwatched" ${releasedCount === 0 ? 'disabled aria-disabled="true"' : ''}>Mark season unwatched</button>
    </div>
    ${eps.length === 0 ? '<div class="section-empty-hint">Episode information is not available yet.</div>' : eps.map((episode) => {
      const released = !!episode.airDate && new Date(episode.airDate) <= now;
      const resolved = released ? resolveEpisode(titleId, episode.seasonNumber, episode.episodeNumber, events, overrides) : { watched: false };
      const state = !released ? 'upcoming' : resolved.watched ? 'watched' : 'unwatched';
      return `
        <div class="episode-row">
          <button type="button" class="episode-check ${state}" data-ep="${episode.episodeNumber}" ${state === 'upcoming' ? 'disabled aria-disabled="true"' : ''} aria-label="${state === 'watched' ? 'Mark unwatched' : 'Mark watched'}" aria-pressed="${state === 'watched'}">${state === 'watched' ? '✓' : ''}</button>
          <details class="episode-details">
            <summary>
              <span class="ep-title">E${episode.episodeNumber} · ${episode.name}</span>
              <span class="ep-meta">${episode.runtime ? episode.runtime + ' min · ' : ''}${episode.airDate ? formatDate(episode.airDate) : 'Date unknown'}${state === 'upcoming' ? ' · Upcoming' : ''}</span>
            </summary>
            <p>${episode.overview || 'No episode synopsis available.'}</p>
          </details>
        </div>
      `;
    }).join('')}
  `;
  list.querySelectorAll('[data-ep]').forEach((button) => button.addEventListener('click', async () => {
    const episodeNumber = Number((button as HTMLElement).dataset.ep);
    const isWatched = (button as HTMLElement).classList.contains('watched');
    await repo.setEpisodeOverride(titleId, activeSeason!, episodeNumber, isWatched ? 'unwatched' : 'watched');
    const bundle = await repo.getTitleBundle(titleId);
    if (bundle) renderEpisodeList(body, titleId, bundle.episodes, bundle.events, bundle.overrides);
  }));
  list.querySelector('#season-watched')?.addEventListener('click', async () => {
    await repo.setSeasonOverride(titleId, activeSeason!, 'watched');
    const bundle = await repo.getTitleBundle(titleId);
    if (bundle) renderEpisodeList(body, titleId, bundle.episodes, bundle.events, bundle.overrides);
  });
  list.querySelector('#season-unwatched')?.addEventListener('click', async () => {
    await repo.setSeasonOverride(titleId, activeSeason!, 'unwatched');
    const bundle = await repo.getTitleBundle(titleId);
    if (bundle) renderEpisodeList(body, titleId, bundle.episodes, bundle.events, bundle.overrides);
  });
}

function compareEpisode(a: Episode, b: Episode) {
  return a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber;
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Date unknown';
  return new Date(value).toLocaleDateString();
}

function overrideLabel(override: WatchOverride) {
  if (override.scopeType === 'movie') return 'Movie';
  if (override.scopeType === 'season') return `Season ${override.seasonNumber}`;
  return `S${override.seasonNumber} · E${override.episodeNumber}`;
}
