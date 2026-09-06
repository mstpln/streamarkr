import * as repo from '../../lib/repo.js';
import { serviceLogoHtml } from '../logos.js';

type SettingsTab = 'preferences' | 'connections' | 'data';

/** Settings always lands on Preferences when entered from navigation. Internal tab changes pass
 * the desired tab explicitly so rerenders do not bounce the user back unexpectedly. */
export async function render(el: HTMLElement, activeTab: SettingsTab = 'preferences') {
  el.innerHTML = `<div class="skeleton" style="height:220px;border-radius:16px;"></div>`;
  const services = await repo.allServices();

  el.innerHTML = `
    <div class="page-title">Settings</div>
    <div class="settings-tabs pill-row">
      <button class="pill ${activeTab === 'preferences' ? 'active' : ''}" data-tab="preferences">Preferences</button>
      <button class="pill ${activeTab === 'connections' ? 'active' : ''}" data-tab="connections">Connections</button>
      <button class="pill ${activeTab === 'data' ? 'active' : ''}" data-tab="data">Data</button>
    </div>
    <div id="settings-body"></div>
  `;
  el.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => {
    void render(el, (button as HTMLElement).dataset.tab as SettingsTab);
  }));

  const body = el.querySelector('#settings-body')!;
  if (activeTab === 'preferences') {
    body.innerHTML = `
      <div class="card">
        <div class="card-row"><span>Region</span><span>Sweden</span></div>
      </div>
      <div class="card">
        <div style="font-weight:700;margin-bottom:8px;">My streaming services</div>
        ${services.map((service) => `
          <div class="card-row">
            <span style="display:inline-flex;align-items:center;gap:8px;">${serviceLogoHtml(service.serviceKey, service.displayName, 22)}${service.displayName}</span>
            <button class="toggle ${service.userSelected ? 'on' : ''}" data-svc="${service.serviceKey}" role="switch" aria-checked="${service.userSelected}" aria-label="${service.displayName}"></button>
          </div>
        `).join('')}
        <div class="card-row">
          <label class="sr-only" for="new-svc">Add another streaming service</label>
          <input id="new-svc" placeholder="Add another service" style="background:transparent;border:none;color:var(--text);flex:1;outline:none;" />
          <button class="action-btn" id="add-svc">Add</button>
        </div>
      </div>
    `;
    body.querySelectorAll('[data-svc]').forEach((button) => button.addEventListener('click', async () => {
      const key = (button as HTMLElement).dataset.svc!;
      const service = services.find((item) => item.serviceKey === key)!;
      await repo.setServiceSelected(key, !service.userSelected);
      await render(el, 'preferences');
    }));
    body.querySelector('#add-svc')?.addEventListener('click', async () => {
      const input = body.querySelector('#new-svc') as HTMLInputElement;
      if (input.value.trim()) {
        await repo.addCustomService(input.value);
        await render(el, 'preferences');
      }
    });
  } else if (activeTab === 'connections') {
    body.innerHTML = `
      <div class="card">
        <div class="card-row"><span><span class="status-dot off"></span>Trakt</span><span>Not connected (local build)</span></div>
        <div class="card-row"><span><span class="status-dot ok"></span>TMDB</span><span>Fake adapter active</span></div>
        <div class="card-row"><span><span class="status-dot ok"></span>Streaming Availability</span><span>Fake adapter active</span></div>
        <div class="card-row"><span><span class="status-dot ok"></span>Data storage</span><span>Local (IndexedDB)</span></div>
      </div>
      <button class="action-btn primary" id="sync-now" style="width:100%;justify-content:center;">Sync now</button>
      <div id="sync-status" class="section-empty-hint" style="margin-top:8px;" aria-live="polite"></div>
    `;
    body.querySelector('#sync-now')?.addEventListener('click', async () => {
      const status = body.querySelector('#sync-status')!;
      status.textContent = 'Syncing…';
      const result = await repo.syncNow();
      status.textContent = `Synced. ${result.historyEvents} history events checked, ${result.alertsCreated} new alert(s).`;
    });
  } else {
    body.innerHTML = `
      <div class="card">
        <div class="card-row"><span>History / import</span><span>Local fixtures</span></div>
        <div class="card-row"><span>Export personal data</span><button class="action-btn" id="export-btn">Export JSON</button></div>
        <div class="card-row"><span>Reset local data</span><button class="action-btn" id="reset-btn" style="border-color:var(--coral);color:var(--coral);">Reset to fixtures…</button></div>
        <div class="card-row"><span>App version</span><span>v0.10.2 (local build)</span></div>
      </div>
    `;
    body.querySelector('#export-btn')?.addEventListener('click', async () => {
      const exportData = await repo.buildExportPayload();
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'streamarkr-export.json';
      link.click();
      URL.revokeObjectURL(link.href);
    });
    body.querySelector('#reset-btn')?.addEventListener('click', async () => {
      if (confirm('This resets all local data back to the demo fixtures. Continue?')) {
        await repo.resetToFixtures();
        await render(el, 'data');
      }
    });
  }
}
