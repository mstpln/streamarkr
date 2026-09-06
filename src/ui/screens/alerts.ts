import * as repo from '../../lib/repo.js';
import { posterStyle } from '../art.js';
import { navigate } from '../router.js';

export async function render(el: HTMLElement) {
  el.innerHTML = `<div class="skeleton" style="height:300px;border-radius:16px;"></div>`;
  const alerts = (await repo.allAlerts()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unseenIds = alerts.filter((a) => !a.seenAt).map((a) => a.id);

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
          ${!a.seenAt ? '<span class="new-dot"></span>' : ''}
        </button>
      `).join('')}
    </div>`}
  `;
  el.querySelectorAll('[data-open]').forEach((r) => r.addEventListener('click', () => navigate(`#/title/${(r as HTMLElement).dataset.open}`)));

  // Newly unseen alerts stay visually marked for this visit; persist as seen so badge clears
  // and the next visit shows no NEW indicator.
  if (unseenIds.length > 0) {
    await repo.markAlertsSeen(unseenIds);
  }
}
