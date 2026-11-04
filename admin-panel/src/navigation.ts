import { useEffect, useState } from 'react';

export const pages = { participants: 'Участники', race: 'Этапы и маршрут', monitoring: 'Мониторинг оборудования', results: 'Результаты', content: 'Контент', push: 'Push-рассылки', supporters: 'Статистика болельщиков' };
export interface AdminRoute { section: keyof typeof pages; raceId?: number; stageId?: number }

export function readAdminRoute(): AdminRoute {
  const params = new URLSearchParams(location.hash.slice(1));
  const section = params.get('section');
  const positive = (name: string) => { const n = Number(params.get(name)); return Number.isSafeInteger(n) && n > 0 ? n : undefined; };
  return { section: section && Object.hasOwn(pages, section) ? section as keyof typeof pages : 'monitoring', raceId: positive('race'), stageId: positive('stage') };
}

export function updateAdminRoute(patch: Partial<AdminRoute>) {
  const route = { ...readAdminRoute(), ...patch };
  const params = new URLSearchParams({ section: route.section });
  if (route.raceId) params.set('race', String(route.raceId));
  if (route.stageId) params.set('stage', String(route.stageId));
  history.pushState(null, '', '#' + params);
  window.dispatchEvent(new Event('hashchange'));
}

export function useAdminRoute() {
  const [route, setRoute] = useState(readAdminRoute);
  useEffect(() => {
    const update = () => setRoute(readAdminRoute());
    window.addEventListener('hashchange', update); window.addEventListener('popstate', update);
    return () => { window.removeEventListener('hashchange', update); window.removeEventListener('popstate', update); };
  }, []);
  return route;
}
