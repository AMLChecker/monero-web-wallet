import { useCallback, useEffect, useState } from 'react';

export const ROUTES = [
  'welcome',
  'create',
  'dashboard',
  'send',
  'receive',
  'transactions',
  'support',
  'settings',
] as const;
export type Route = (typeof ROUTES)[number];

export const WALLET_ROUTES: Route[] = ['dashboard', 'send', 'receive', 'transactions', 'support', 'settings'];

function parseHash(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0].toLowerCase();
  return (ROUTES as readonly string[]).includes(raw) ? (raw as Route) : 'welcome';
}

/** Minimal hash router: works when the app is served from a local build with no server routes. */
export function useHashRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(parseHash);

  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((next: Route) => {
    if (parseHash() === next) {
      setRoute(next);
      return;
    }
    window.location.hash = `#/${next}`;
  }, []);

  return [route, navigate];
}
