import { useEffect, useState } from 'react';
import { readRaceLink } from '../api/navigation';

export function useRoute() {
  const [route, setRoute] = useState(readRaceLink);
  useEffect(() => {
    const sync = () => setRoute(readRaceLink());
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => { window.removeEventListener('hashchange', sync); window.removeEventListener('popstate', sync); };
  }, []);
  return route;
}
