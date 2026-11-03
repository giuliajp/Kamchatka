import { useEffect, useState } from 'react';
import { AppProviders } from './app/AppProviders';
import { MapScreen } from './screens/Map/MapScreen';

export function App() {
  const [media] = useState(() => window.matchMedia('(prefers-color-scheme: dark)'));
  const [dark, setDark] = useState(media.matches);
  useEffect(() => {
    const update = (event: MediaQueryListEvent) => setDark(event.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [media]);
  return <AppProviders fullScreen appearance={dark ? 'dark' : 'light'}><MapScreen /></AppProviders>;
}
