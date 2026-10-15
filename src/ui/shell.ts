import { navigate, type Route } from './router.js';
import * as repo from '../lib/repo.js';

const NAV_ITEMS: { route: Route['name']; label: string; icon: string; path: string }[] = [
  { route: 'home', label: 'Home', icon: '<path d="m3 10 9-7 9 7"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/>', path: '#/home' },
  { route: 'discover', label: 'Discover', icon: '<circle cx="12" cy="12" r="9"/><path d="m16.2 7.8-2.1 6.3-6.3 2.1 2.1-6.3 6.3-2.1Z"/>', path: '#/discover' },
  { route: 'library', label: 'My Library', icon: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>', path: '#/library' },
  { route: 'history', label: 'History', icon: '<path d="M3 12a9 9 0 1 0 2.64-6.36L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3.5 2"/>', path: '#/history' },
  { route: 'settings', label: 'Settings', icon: '<path d="M4 7h9"/><path d="M17 7h3"/><circle cx="15" cy="7" r="2"/><path d="M4 12h3"/><path d="M11 12h9"/><circle cx="9" cy="12" r="2"/><path d="M4 17h8"/><path d="M16 17h4"/><circle cx="14" cy="17" r="2"/>', path: '#/settings' }
];

const MAIN_ROUTES = new Set(['home', 'discover', 'library', 'history', 'settings']);
const svgIcon = (paths: string, className: string) =>
  `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export function renderShell(root: HTMLElement) {
  root.innerHTML = `
    <header class="app-header" id="app-header"></header>
    <main class="screen" id="screen"></main>
    <nav class="bottom-nav" id="bottom-nav"></nav>
  `;
}

export async function updateHeader(route: Route) {
  const header = document.getElementById('app-header')!;
  const isHome = route.name === 'home';
  const unread = (await repo.allAlerts()).filter((a) => !a.seenAt).length;
  header.innerHTML = `
    <div class="brand">
      <span class="brand-logo"></span>
      ${isHome ? '<span>Streamarkr</span>' : ''}
    </div>
    <div class="header-actions">
      <button class="icon-btn" id="btn-search" aria-label="Search">
        ${svgIcon('<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>', 'header-svg')}
      </button>
      <button class="icon-btn" id="btn-alerts" aria-label="Alerts">
        ${svgIcon('<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>', 'header-svg')}
        ${unread > 0 ? `<span class="badge">${unread > 9 ? '9+' : unread}</span>` : ''}
      </button>
    </div>
  `;
  header.querySelector('#btn-search')!.addEventListener('click', () => navigate('#/search'));
  header.querySelector('#btn-alerts')!.addEventListener('click', () => navigate('#/alerts'));
}

export function updateNav(route: Route) {
  const nav = document.getElementById('bottom-nav')!;
  nav.innerHTML = NAV_ITEMS.map(
    (item) => `
    <button class="nav-item ${route.name === item.route ? 'active' : ''}" data-path="${item.path}" aria-current="${route.name === item.route ? 'page' : 'false'}">
      <span class="nav-icon">${svgIcon(item.icon, 'nav-svg')}</span>
      <span>${item.label}</span>
    </button>`
  ).join('');
  nav.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => navigate((btn as HTMLElement).dataset.path!));
  });
}

export function getScreenEl(): HTMLElement {
  return document.getElementById('screen')!;
}

export function isMainRoute(name: string) {
  return MAIN_ROUTES.has(name);
}
