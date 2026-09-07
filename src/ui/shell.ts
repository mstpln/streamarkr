import { navigate, type Route } from './router.js';
import * as repo from '../lib/repo.js';

const NAV_ITEMS: { route: Route['name']; label: string; icon: string; path: string }[] = [
  { route: 'home', label: 'Home', icon: '⌂', path: '#/home' },
  { route: 'discover', label: 'Discover', icon: '✦', path: '#/discover' },
  { route: 'library', label: 'My Library', icon: '♥', path: '#/library' },
  { route: 'history', label: 'History', icon: '◷', path: '#/history' },
  { route: 'settings', label: 'Settings', icon: '⚙', path: '#/settings' }
];

const MAIN_ROUTES = new Set(['home', 'discover', 'library', 'history', 'settings']);

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
      <button class="icon-btn" id="btn-search" aria-label="Search">🔍</button>
      <button class="icon-btn" id="btn-alerts" aria-label="Alerts">
        🔔
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
      <span class="nav-icon">${item.icon}</span>
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
