import { renderShell, updateHeader, updateNav, getScreenEl } from './ui/shell.js';
import { onRouteChange, type Route } from './ui/router.js';
import { ensureSeeded } from './lib/repo.js';

import * as Home from './ui/screens/home.js';
import * as Discover from './ui/screens/discover.js';
import * as Library from './ui/screens/library.js';
import * as History from './ui/screens/history.js';
import * as Settings from './ui/screens/settings.js';
import * as Search from './ui/screens/search.js';
import * as Alerts from './ui/screens/alerts.js';
import * as Detail from './ui/screens/detail.js';

async function boot() {
  await ensureSeeded();
  const app = document.getElementById('app')!;
  renderShell(app);

  onRouteChange(async (route: Route) => {
    window.scrollTo(0, 0);
    await updateHeader(route);
    updateNav(route);
    const screen = getScreenEl();
    switch (route.name) {
      case 'home': return Home.render(screen);
      case 'discover': return Discover.render(screen);
      case 'library': return Library.render(screen);
      case 'history': return History.render(screen);
      case 'settings': return Settings.render(screen);
      case 'search': return Search.render(screen);
      case 'alerts': return Alerts.render(screen);
      case 'detail': return Detail.render(screen, route.id);
    }
  });
}

boot();
