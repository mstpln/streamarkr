import { backendActivationFailureMessage } from '../../lib/backend-activation-diagnostics.js';
import { WorkerBackendClient } from '../../lib/backend-client.js';
import { migrateLocalStateToBackend } from '../../lib/backend-migration.js';
import * as repo from '../../lib/repo.js';
import { serviceLogoHtml } from '../logos.js';

type SettingsTab = 'preferences' | 'connections' | 'data';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function secureTokenInput(id: string, buttonId: string, buttonLabel: string): string {
  return `
    <div class="card-row">
      <label class="sr-only" for="${id}">Device access token</label>
      <input id="${id}" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Device access token" style="background:transparent;border:none;color:var(--text);flex:1;outline:none;min-width:0;" />
      <button class="action-btn primary" id="${buttonId}">${buttonLabel}</button>
    </div>`;
}

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
            <span style="display:inline-flex;align-items:center;gap:8px;">${serviceLogoHtml(service.serviceKey, service.displayName, 22)}${escapeHtml(service.displayName)}</span>
            <button class="toggle ${service.userSelected ? 'on' : ''}" data-svc="${escapeHtml(service.serviceKey)}" role="switch" aria-checked="${service.userSelected}" aria-label="${escapeHtml(service.displayName)}"></button>
          </div>
        `).join('')}
        <div class="card-row">
          <label class="sr-only" for="new-svc">Add another streaming service</label>
          <input id="new-svc" maxlength="80" placeholder="Add another service" style="background:transparent;border:none;color:var(--text);flex:1;outline:none;" />
          <button class="action-btn" id="add-svc">Add</button>
        </div>
        <div id="svc-status" class="section-empty-hint" aria-live="polite"></div>
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
      const status = body.querySelector('#svc-status')!;
      const name = input.value.trim();
      if (!name) return;
      if (!/[a-z0-9]/i.test(name)) {
        status.textContent = 'Use at least one letter or number in the service name.';
        return;
      }
      try {
        await repo.addCustomService(name);
        await render(el, 'preferences');
      } catch {
        status.textContent = 'That service name conflicts with an existing streaming service.';
      }
    });
  } else if (activeTab === 'connections') {
    const cache = await repo.backendCacheInfo();
    body.innerHTML = `
      <div class="card">
        <div class="card-row"><span><span class="status-dot off"></span>Trakt</span><span>Not connected (synthetic mode)</span></div>
        <div class="card-row"><span><span class="status-dot ok"></span>TMDB</span><span>Fake adapter active</span></div>
        <div class="card-row"><span><span class="status-dot ok"></span>Streaming Availability</span><span>Fake adapter active</span></div>
        <div class="card-row"><span><span class="status-dot ${cache.active ? 'ok' : 'off'}"></span>Data storage</span><span>${cache.active ? 'Worker/D1 active · verified snapshot cached offline' : 'Local IndexedDB · ready for one-time Worker/D1 migration'}</span></div>
      </div>
      ${cache.active ? `
        <button class="action-btn primary" id="backend-refresh" style="width:100%;justify-content:center;">Refresh Worker/D1 data</button>
        <div class="card" style="margin-top:10px;">
          <div style="font-weight:700;margin-bottom:6px;">Secure browser session</div>
          <div class="section-empty-hint" style="margin-bottom:10px;">If the session has expired or was cleared, enter the device access token again. The token is exchanged for a new secure session and is never stored.</div>
          ${secureTokenInput('reconnect-token', 'reconnect-session', 'Reconnect')}
        </div>
        <div id="backend-status" class="section-empty-hint" style="margin-top:8px;" aria-live="polite"></div>
      ` : `
        <div class="card">
          <div style="font-weight:700;margin-bottom:6px;">Connect secure storage</div>
          <div class="section-empty-hint" style="margin-bottom:10px;">Enter the Streamarkr device access token once. It is exchanged for a secure browser session and is never stored in this app.</div>
          ${secureTokenInput('device-token', 'activate-backend', 'Connect')}
          <div id="backend-status" class="section-empty-hint" aria-live="polite"></div>
        </div>
        <button class="action-btn" id="sync-now" style="width:100%;justify-content:center;">Sync synthetic data</button>
        <div id="sync-status" class="section-empty-hint" style="margin-top:8px;" aria-live="polite"></div>
      `}
    `;

    if (cache.active) {
      body.querySelector('#backend-refresh')?.addEventListener('click', async () => {
        const status = body.querySelector('#backend-status')!;
        status.textContent = 'Refreshing…';
        try {
          const result = await repo.refreshBackendCache();
          status.textContent = `Worker/D1 refreshed ${new Date(result.generatedAt).toLocaleString()}.`;
        } catch {
          status.textContent = 'Could not refresh Worker/D1. The last verified offline cache is unchanged. Reconnect the secure session if it has expired.';
        }
      });
      body.querySelector('#reconnect-session')?.addEventListener('click', async () => {
        const input = body.querySelector('#reconnect-token') as HTMLInputElement;
        const button = body.querySelector('#reconnect-session') as HTMLButtonElement;
        const status = body.querySelector('#backend-status')!;
        const token = input.value;
        if (!token) {
          status.textContent = 'Enter the device access token first.';
          return;
        }
        button.disabled = true;
        status.textContent = 'Securing browser session…';
        const client = new WorkerBackendClient('');
        try {
          await client.bootstrapSession(token);
        } catch (error) {
          input.value = '';
          button.disabled = false;
          status.textContent = backendActivationFailureMessage('bootstrap', error);
          return;
        }
        input.value = '';
        status.textContent = 'Verifying secure browser session…';
        try {
          await client.getSessionStatus();
        } catch (error) {
          button.disabled = false;
          status.textContent = backendActivationFailureMessage('verify-session', error);
          return;
        }
        try {
          const result = await repo.refreshBackendCache();
          status.textContent = `Secure session renewed. Worker/D1 refreshed ${new Date(result.generatedAt).toLocaleString()}.`;
        } catch {
          button.disabled = false;
          status.textContent = 'Secure session works, but Worker/D1 could not be refreshed. The last verified offline cache is unchanged.';
        }
      });
    } else {
      body.querySelector('#activate-backend')?.addEventListener('click', async () => {
        const input = body.querySelector('#device-token') as HTMLInputElement;
        const button = body.querySelector('#activate-backend') as HTMLButtonElement;
        const status = body.querySelector('#backend-status')!;
        const token = input.value;
        if (!token) {
          status.textContent = 'Enter the device access token first.';
          return;
        }
        button.disabled = true;
        status.textContent = 'Securing browser session…';
        const client = new WorkerBackendClient('');
        try {
          await client.bootstrapSession(token);
        } catch (error) {
          input.value = '';
          button.disabled = false;
          status.textContent = backendActivationFailureMessage('bootstrap', error);
          return;
        }
        input.value = '';
        status.textContent = 'Verifying secure browser session…';
        try {
          await client.getSessionStatus();
        } catch (error) {
          button.disabled = false;
          status.textContent = backendActivationFailureMessage('verify-session', error);
          return;
        }
        status.textContent = 'Secure session verified. Migrating and verifying local data…';
        try {
          await migrateLocalStateToBackend(client);
          await render(el, 'connections');
        } catch (error) {
          button.disabled = false;
          status.textContent = backendActivationFailureMessage('migration', error);
        }
      });
      body.querySelector('#sync-now')?.addEventListener('click', async () => {
        const status = body.querySelector('#sync-status')!;
        status.textContent = 'Syncing…';
        const result = await repo.syncNow();
        status.textContent = `Synced. ${result.historyEvents} history events checked, ${result.alertsCreated} new alert(s).`;
      });
    }
  } else {
    const cache = await repo.backendCacheInfo();
    body.innerHTML = `
      <div class="card">
        <div class="card-row"><span>History / import</span><span>${cache.active ? 'Worker/D1 durable state' : 'Synthetic fixtures'}</span></div>
        <div class="card-row"><span>Export personal data</span><button class="action-btn" id="export-btn">Export JSON</button></div>
        <div class="card-row"><span>Reset local data</span><button class="action-btn" id="reset-btn" style="border-color:var(--coral);color:var(--coral);" ${cache.active ? 'disabled aria-disabled="true"' : ''}>${cache.active ? 'Disabled while Worker/D1 is active' : 'Reset to fixtures…'}</button></div>
        <div class="card-row"><span>App version</span><span>v0.18.0 (same-origin Worker hosting)</span></div>
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
    if (!cache.active) {
      body.querySelector('#reset-btn')?.addEventListener('click', async () => {
        if (confirm('This resets all local data back to the demo fixtures. Continue?')) {
          await repo.resetToFixtures();
          await render(el, 'data');
        }
      });
    }
  }
}