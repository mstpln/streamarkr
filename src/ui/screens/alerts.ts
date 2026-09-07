import * as repo from '../../lib/repo.js';
import { posterStyle } from '../art.js';
import { navigate } from '../router.js';

let currentVisitUnseenIds: string[] = [];

export async function render(el: HTMLElement) {
  el.innerHTML = `<div class="skeleton" style="height:300px;border-radius:16px;"></div>`;
  const alerts = (await repo.allAlerts()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 30);
  currentVisitUnseenIds = alerts.filter((a) => !a.seenAt).map((a) => a.id);

  el.innerHTML = `
    <div class="page-title">Alerts</div>
    ${alerts.length === 0 ? '<div class="empty-state">No alerts yet.</div>' : `
    <div class="row-list">
      ${alerts.map((a) => `
        <button type="button" class="row-item row-button" data-open="${a.titleId}">
          <div class="row-thumb small" style="${posterStyle(a.titleId)}"></div>
          <div class="row-body">
            <div class="row-alert-text">${a.message}</div>
            <div class="row-meta">${new Date(a.createdAt).toLocaleDateString()}</div>
          </div>
          ${!a.seenAt ? '<span class="new-dot" aria-label="New alert"></span>' : ''}
        </button>
      `).join('')}
    </div>`}
  `;
  el.querySelectorAll('[data-open]').forEach((row) => row.addEventListener('click', () => navigate(`#/title/${(row as HTMLElement).dataset.open}`)));
}

/** Persist the unseen alerts from this Alerts-page visit only when the user leaves the page.
 * This keeps NEW indicators visible for the whole first visit, matching the product lifecycle,
 * while allowing the header badge to clear before the destination screen renders. */
export async function commitVisitSeen(): Promise<void> {
  const ids = currentVisitUnseenIds;
  currentVisitUnseenIds = [];
  if (ids.length > 0) await repo.markAlertsSeen(ids);
}
