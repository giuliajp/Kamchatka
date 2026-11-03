import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MapScreen } from '../src/screens/Map/MapScreen';
import { AppProviders } from '../src/app/AppProviders';
import { fixtureResponse, mockApi, positions, stage, participant, race, discipline } from './fixtures';
import type { MapCanvasProps } from '../src/screens/Map/MapCanvas';
vi.mock('../src/screens/Map/MapCanvas', () => ({ MapCanvas: (props: MapCanvasProps) => <div>
  {props.data.participants.map(p => <button key={p.race_participant_id} onClick={() => props.onSelect(p)}>Точка {p.start_number}{props.supported?.includes(p.race_participant_id) ? ' — мой' : ''}</button>)}
  <button onClick={props.onLegend}>Легенда</button>
</div> }));
beforeEach(() => { vi.stubEnv('VITE_MOCK_MISSING_FEATURES', 'true'); });
afterEach(() => { localStorage.clear(); history.replaceState(null, '', '/'); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const show = () => render(<AppProviders><MapScreen /></AppProviders>);
it('synchronises support from sheet to map, list and My filter without replacing API results', async () => {
  const api = mockApi(); const user = userEvent.setup(); show();
  await user.click(await screen.findByRole('tab', { name: 'Мои' }));
  expect(await screen.findByText('Вы пока ни за кого не болеете')).toBeVisible();
  await user.click(screen.getByRole('tab', { name: 'Дисциплина: все' }));
  await user.click(await screen.findByRole('radio', { name: 'все' }));
  await user.click(await screen.findByRole('button', { name: 'Точка 14' }));
  await user.click(await screen.findByRole('button', { name: 'Болею за' }));
  await user.click(await screen.findByRole('button', { name: 'Позже' }));
  await user.click(screen.getByRole('button', { name: 'Свернуть' }));
  await user.click(await screen.findByRole('tab', { name: /Мои/ }));
  expect(await screen.findByRole('button', { name: 'Точка 14 — мой' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Точка 22' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Участники' }));
  await user.click(await screen.findByRole('button', { name: 'Вы болеете' }));
  expect(await screen.findByText(/В вашем списке нет участников/)).toBeVisible();
  expect(api).toHaveBeenCalledWith('/api/races/10/participants?discipline=sled_8&sort=start_number', expect.anything());
});
it('opens the legend and closes the top surface with Escape', async () => {
  mockApi(); const user = userEvent.setup(); show();
  await user.click(await screen.findByRole('button', { name: 'Легенда' }));
  expect(await screen.findByRole('dialog', { name: 'Условные обозначения' })).toBeVisible();
  expect(screen.getByRole('img', { name: /Участник 21, позиция подтверждена, мой участник, лидер/ })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Закрыть легенду' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await user.click(screen.getByRole('button', { name: 'Легенда' })); await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
it('restores IDs from a share URL and handles back navigation without losing API identity', async () => {
  history.replaceState(null, '', '/?race=10&stage=103&person=501&entry=9001'); const api = mockApi(); show();
  expect(await screen.findByRole('dialog', { name: 'Карточка участника' })).toBeVisible();
  expect(await screen.findByText('Алиса Иванова')).toBeVisible();
  expect(api).toHaveBeenCalledWith('/api/races/10', expect.anything());
  history.replaceState(null, '', '/?race=10&stage=104'); act(() => window.dispatchEvent(new PopStateEvent('popstate')));
  expect(await screen.findByRole('heading', { name: 'Этап 4 начнётся' })).toBeVisible();
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
it('does not treat empty API coordinates or failed API requests as successful mock positions', async () => {
  
  mockApi(url => url.endsWith('/me/supports') ? [{ ...participant, race_id: race.id, discipline, notifications_enabled: false, supported_since: stage.start_at }] : url.includes('/positions') ? { ...positions, participants: [] } : /\/stages\//.test(url) ? { ...stage, route_geojson: null, checkpoints: [] } : fixtureResponse(url));
  show(); await userEvent.click(await screen.findByRole('tab', { name: /Мои/ }));
  expect(await screen.findByText('У поддерживаемых участников пока нет подтверждённых координат.')).toBeVisible();
  expect(screen.queryByRole('button', { name: /Точка / })).not.toBeInTheDocument();
});
it('keeps public map available when personal login fails', async () => {
  vi.stubEnv('VITE_MOCK_MISSING_FEATURES', 'false'); mockApi(url => url.endsWith('/me/visit') ? null : fixtureResponse(url)); show();
  await screen.findByRole('button', { name: 'Точка 14' });
  expect(screen.queryByRole('tab', { name: /Мои/ })).not.toBeInTheDocument();
});
it('distinguishes supported participants without GPS from an empty support list', async () => {
  
  mockApi(url => url.endsWith('/me/supports') ? [{ ...participant, race_id: race.id, discipline, notifications_enabled: false, supported_since: stage.start_at }] : url.includes('/positions') ? { ...positions, participants: [] } : fixtureResponse(url));
  show(); await userEvent.click(await screen.findByRole('tab', { name: /Мои/ }));
  expect(await screen.findByText('У ваших участников пока нет координат')).toBeVisible();
});
it('restores a shared stage from overall results instead of keeping the previous section', async () => {
  history.replaceState(null, '', '/?race=10');
  const user = userEvent.setup(); mockApi(); show();
  await user.click(await screen.findByRole('button', { name: 'Результаты' }));
  await user.click(screen.getByRole('combobox', { name: 'Этап гонки' }));
  await user.click(screen.getByRole('option', { name: /Общий зачёт/ }));
  await screen.findByRole('heading', { name: 'Общий зачёт' });
  history.replaceState(null, '', '/?race=10&stage=104');
  act(() => window.dispatchEvent(new PopStateEvent('popstate')));
  expect(await screen.findByRole('heading', { name: 'Этап 4 начнётся' })).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Общий зачёт' })).not.toBeInTheDocument();
});
it('does not attach another person’s GPS or track to a mixed share URL', async () => {
  history.replaceState(null, '', '/?race=10&stage=103&person=501&entry=9002');
  const api = mockApi(); show();
  await screen.findByText('Алиса Иванова');
  expect(screen.getByText('Участник не заявлен на выбранную гонку.')).toBeVisible();
  expect(screen.queryByLabelText(/Позиция по GPS-трекеру/)).not.toBeInTheDocument();
  expect(api.mock.calls.some(([input]) => String(input).includes('/race-participants/9002/track'))).toBe(false);
});
it('closes only the notification prompt when Escape bubbles through a participant sheet', async () => {
  const user = userEvent.setup(); mockApi(); show();
  await user.click(await screen.findByRole('button', { name: 'Точка 14' }));
  await user.click(await screen.findByRole('button', { name: 'Болею за' }));
  const later = await screen.findByRole('button', { name: 'Позже' });
  later.focus(); await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Позже' })).not.toBeInTheDocument());
  expect(screen.getByRole('dialog', { name: 'Карточка участника' })).toBeVisible();
});
