import { useEffect, useState } from 'react';
import bridge from '@vkontakte/vk-bridge';
import { AppProviders } from './app/AppProviders';
import { RaceApp } from './app/RaceApp';

export function App() {
  const [media] = useState(() => window.matchMedia('(prefers-color-scheme: dark)'));
  const [dark, setDark] = useState(media.matches);
  const [vkAppearance, setVkAppearance] = useState<'light' | 'dark'>();
  useEffect(() => {
    if (!bridge.isEmbedded()) return;
    const update: Parameters<typeof bridge.subscribe>[0] = event => {
      if (event.detail.type === 'VKWebAppUpdateConfig') setVkAppearance(event.detail.data.appearance);
    };
    bridge.subscribe(update);
    void bridge.send('VKWebAppInit').catch(() => undefined);
    return () => bridge.unsubscribe(update);
  }, []);
  useEffect(() => {
    const update = (event: MediaQueryListEvent) => setDark(event.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [media]);
  return <AppProviders fullScreen appearance={vkAppearance ?? (dark ? 'dark' : 'light')}><RaceApp /></AppProviders>;
}
