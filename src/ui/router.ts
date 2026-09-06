export type Route =
  | { name: 'home' }
  | { name: 'discover' }
  | { name: 'library' }
  | { name: 'history' }
  | { name: 'settings' }
  | { name: 'search' }
  | { name: 'alerts' }
  | { name: 'detail'; id: string };

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, '');
  const [seg, arg] = h.split('/');
  switch (seg) {
    case '': case 'home': return { name: 'home' };
    case 'discover': return { name: 'discover' };
    case 'library': return { name: 'library' };
    case 'history': return { name: 'history' };
    case 'settings': return { name: 'settings' };
    case 'search': return { name: 'search' };
    case 'alerts': return { name: 'alerts' };
    case 'title': return { name: 'detail', id: decodeURIComponent(arg ?? '') };
    default: return { name: 'home' };
  }
}

export function navigate(path: string) {
  location.hash = path;
}

export function onRouteChange(cb: (route: Route) => void) {
  const handler = () => cb(parseHash(location.hash));
  window.addEventListener('hashchange', handler);
  handler();
}
