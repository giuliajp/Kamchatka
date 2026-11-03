import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { AppProviders } from '../src/app/AppProviders';
import { SupportAction } from '../src/components/ParticipantActions';
import { ParticipantSheet } from '../src/components/ParticipantSheet';
import { fixtureResponse, participant, stage } from './fixtures';

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });
it('persists support through the API and never restores demo preferences', async () => {
  localStorage.setItem('avacha-extras-v1', JSON.stringify({ supported: ['10:9001'], subscriptions: [], prompted: [] }));
  let selected = false;
  const fetcher = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = String(input);
    let data;
    if (url.endsWith('/me/supports')) data = selected ? [{ ...participant, race_id: 10, notifications_enabled: true, supported_since: '2026-11-03T00:00:00Z' }] : [];
    else if (url.endsWith('/support')) { selected = options?.method === 'PUT'; data = { race_participant_id: 9001, supporters_count: Number(selected), change_24h: 0, is_supported: selected, notifications_enabled: selected }; }
    else data = fixtureResponse(url);
    return new Response(JSON.stringify({ data }));
  });
  vi.stubGlobal('fetch', fetcher);
  render(<AppProviders><SupportAction raceId={10} entryId={9001} number={14} /></AppProviders>);
  const button = await screen.findByRole('button', { name: 'Болею за' });
  await waitFor(() => expect(button).toBeEnabled());
  await userEvent.click(button);
  await screen.findByRole('button', { name: 'Вы болеете' });
  expect(fetcher).toHaveBeenCalledWith('/api/race-participants/9001/support', expect.objectContaining({ method: 'PUT' }));
});
it('renders actual judge checkpoint timestamps instead of inferred times', async () => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const data = url.includes('/checkpoint-passes') ? [{ stage_id: 103, stage_number: 3, stage_checkpoint_id: 300, order_index: 1, role: 'finish', name: 'Финиш судьи', label: null, km_from_start: 40, required_rest_minutes: 0, arrived_at: '2026-11-03T23:05:00Z', departed_at: null }] : fixtureResponse(url);
    return new Response(JSON.stringify({ data }));
  }));
  render(<AppProviders><ParticipantSheet raceId={10} participantId={501} entryId={9001} stage={stage} threshold={45} onClose={vi.fn()} /></AppProviders>);
  expect(await screen.findByText('Финиш судьи')).toBeVisible();
  expect(screen.getByText('Финиш 04.11, 11:05')).toBeVisible();
  expect(screen.queryByText(/демонстрацион/i)).not.toBeInTheDocument();
});
