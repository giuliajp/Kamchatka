import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { AppProviders } from '../src/app/AppProviders';
import { MapScreen } from '../src/screens/Map/MapScreen';
import type { StageDetail } from '../src/types/api';
import { fixtureResponse, mockApi, positions, race, stage } from './fixtures';

vi.mock('../src/screens/Map/MapCanvas', () => ({ MapCanvas: () => <div role="region" aria-label="Карта маршрута" /> }));
afterEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });
const show = () => render(<AppProviders><MapScreen /></AppProviders>);
function setup(detail: StageDetail, participants = positions.participants) {
  return mockApi(url => {
    if (url.endsWith('/current')) return { ...race, stages: [detail] };
    if (url.endsWith(`/stages/${detail.id}`)) return detail;
    if (url.includes('/positions')) return { ...positions, stage: detail, participants };
    return fixtureResponse(url);
  });
}
const emptyStage = { ...stage, route_geojson: null, checkpoints: [] };

it.each([
  null,
  { type: 'FeatureCollection', features: [] },
])('keeps a finished stage without geography free of live-map content: %j', async geometry => {
  setup({ ...emptyStage, status: 'finished', route_geojson: geometry as StageDetail['route_geojson'] });
  show();
  expect(await screen.findByText(stage.description!)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Результаты этапа' })).toBeVisible();
  expect(screen.queryByRole('tab', { name: /Дисциплина/ })).not.toBeInTheDocument();
  expect(screen.getByText('Маршрут пока не опубликован.')).toBeVisible();
  expect(screen.queryByRole('region', { name: 'Карта маршрута' })).not.toBeInTheDocument();
  expect(document.querySelector('.race-screen__map')).toBeNull();
});
it('keeps the results button working when the map is absent', async () => {
  setup({ ...emptyStage, status: 'finished' }); show();
  await screen.findByText(stage.description!);
  await userEvent.click(screen.getByRole('button', { name: 'Результаты этапа' }));
  expect(await screen.findByRole('button', { name: '№14 · Алиса Иванова' })).toBeVisible();
});
it('keeps published finished routes separate from live GPS content', async () => {
  setup({ ...stage, status: 'finished', description: null }); show();
  await screen.findByRole('heading', { name: 'Этап 3 завершён' });
  await waitFor(() => expect(screen.queryByText('Загружаем данные')).not.toBeInTheDocument());
  expect(screen.queryByRole('region', { name: 'Маршрут и позиции участников' })).not.toBeInTheDocument();
  expect(screen.queryByText('Маршрут пока не опубликован.')).not.toBeInTheDocument();
  expect(screen.queryByText(/Позиции GPS не являются официальными/)).not.toBeInTheDocument();
  expect(document.querySelector('.route-description')).toBeNull();
});
it.each(['planned', 'cancelled'] as const)('does not create or request a map for a %s stage even with geography', async status => {
  const api = setup({ ...stage, status }); show();
  await screen.findByRole('heading', { name: status === 'planned' ? 'Этап 3 начнётся' : 'Этап 3 отменён' });
  expect(screen.queryByRole('region', { name: 'Карта маршрута' })).not.toBeInTheDocument();
  expect(api.mock.calls.some(([url]) => String(url).includes('/stages/') || String(url).includes('/positions'))).toBe(false);
});
it.each(['route', 'checkpoints', 'gps'] as const)('keeps a live map with only %s', async source => {
  setup({ ...emptyStage, description: null, route_geojson: source === 'route' ? stage.route_geojson : null, checkpoints: source === 'checkpoints' ? stage.checkpoints : [] }, source === 'gps' ? positions.participants : []);
  show();
  const map = await screen.findByRole('region', { name: 'Маршрут и позиции участников' });
  expect(map).toHaveClass('race-screen__map');
  if (source === 'gps') expect(await screen.findByText(/Положение на/)).toBeVisible();
  else expect(await screen.findByText('Положения отсутствуют')).toBeVisible();
  if (source !== 'route') expect(screen.getByText('Маршрут пока не опубликован.')).toBeVisible();
});
it('ignores missing or invalid GPS positions and shows a compact live empty state', async () => {
  setup({ ...emptyStage, description: null }, positions.participants.map((p, index) => ({ ...p, position: index ? null : { ...p.position!, latitude: 91 } })));
  show(); expect(await screen.findByText('Маршрут пока не опубликован.')).toBeVisible();
  expect(screen.queryByRole('region', { name: 'Карта маршрута' })).not.toBeInTheDocument();
  expect(screen.getByText(/Положения отсутствуют\. Координаты/)).toBeVisible();
});
it('waits for GPS before declaring the entire live map empty', async () => {
  const api = setup(emptyStage, []); const original = api.getMockImplementation()!;
  let finish!: (response: Response) => void;
  api.mockImplementation(input => String(input).includes('/positions') ? new Promise<Response>(resolve => { finish = resolve; }) : original(input));
  show(); await screen.findByText(stage.description!);
  expect(screen.getByText('Загружаем данные')).toBeInTheDocument();
  expect(screen.queryByText('Маршрут пока не опубликован.')).not.toBeInTheDocument();
  expect(document.querySelector('.race-screen__map')).toBeNull();
  await act(async () => finish(new Response(JSON.stringify({ data: { ...positions, participants: [] } }))));
  expect(await screen.findByText('Маршрут пока не опубликован.')).toBeVisible();
});
it.each(['detail', 'positions'] as const)('keeps a %s request failure distinct from an empty map and retries it', async failed => {
  const api = setup({ ...emptyStage, status: failed === 'detail' ? 'finished' : 'live' }, []);
  const original = api.getMockImplementation()!;
  api.mockImplementation(input => String(input).includes(failed === 'detail' ? '/stages/' : '/positions') ? Promise.reject(new Error('network')) : original(input));
  show(); await screen.findByText('Не удалось связаться с сервером');
  expect(screen.queryByText('Маршрут пока не опубликован.')).not.toBeInTheDocument();
  expect(document.querySelector('.race-screen__map')).toBeNull();
  api.mockImplementation(original); await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
  if (failed === 'detail') expect(await screen.findByText(stage.description!)).toBeVisible();
  else await waitFor(() => expect(screen.getByText('Маршрут пока не опубликован.')).toBeVisible());
});
