import { createContext, Fragment, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import bridge from '@vkontakte/vk-bridge';
import { ApiError, mutate } from '../api/client';
import { useApi, type Resource } from '../hooks/useApi';
import type { MySupport } from '../types/content';

interface User { id?: number; allowed: boolean; loading: boolean; error?: string; supports: Resource<MySupport[]>; refresh: () => void; setNotifications: (allowed: boolean) => Promise<void> }
const Context = createContext<User | null>(null);
export function UserProvider({ children }: { children: ReactNode }) {
  const [launch, setLaunch] = useState(location.search);
  const [revision, setRevision] = useState(0);
  const [session, setSession] = useState<{ launch: string; id?: number; allowed: boolean; error?: string }>();
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => { const sync = () => setLaunch(location.search); window.addEventListener('popstate', sync); return () => window.removeEventListener('popstate', sync); }, []);
  useEffect(() => {
    const controller = new AbortController();
    void mutate<{ vk_user_id: number }>('/me/visit', 'POST', undefined, controller.signal).then(data => {
      if (!controller.signal.aborted) setSession({ launch, id: data.vk_user_id, allowed: new URLSearchParams(launch).get('vk_are_notifications_enabled') === '1' });
    }).catch(error => {
      if (!controller.signal.aborted) setSession({ launch, allowed: false, error: error instanceof ApiError ? error.message : 'Не удалось проверить вход. Повторите попытку.' });
    });
    return () => controller.abort();
  }, [launch, revision]);
  const current = session?.launch === launch ? session : undefined;
  const supports = useApi<MySupport[]>(current?.id ? '/me/supports' : null, 120000, false);
  const setNotifications = async (allowed: boolean) => {
    if (!current?.id || !bridge.isEmbedded()) throw new Error('Откройте приложение во ВКонтакте');
    const result = await bridge.send(allowed ? 'VKWebAppAllowNotifications' : 'VKWebAppDenyNotifications');
    if (!result.result) throw new Error('Разрешение не подтверждено');
    const saved = await mutate<{ notifications_allowed: boolean }>('/me/notifications', 'PUT', { allowed });
    setSession(previous => previous?.launch === launch ? { ...previous, allowed: saved.notifications_allowed } : previous);
  };
  return <Context.Provider value={{ id: current?.id, allowed: current?.allowed ?? false, loading: !current, error: current?.error, supports, refresh, setNotifications }}><Fragment key={launch}>{children}</Fragment></Context.Provider>;
}
export function useUser() {
  const user = useContext(Context);
  if (!user) throw new Error('UserProvider is required');
  return user;
}
