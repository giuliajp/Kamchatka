import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { AppProviders } from '../src/app/AppProviders';
import { ParticipantSheet } from '../src/components/ParticipantSheet';
const participant = { name: 'Алиса Иванова', number: 14, region: 'Камчатский край', discipline: 'Ездовые лайки | 12 собак', supported: false, onSupportToggle: vi.fn() };
it('composes identity, position, independent statuses, route and actions', async () => {
  const user = userEvent.setup();
  const onShare = vi.fn(); const onClose = vi.fn(); const onPhotos = vi.fn(); const onRoute = vi.fn();
  render(<AppProviders><ParticipantSheet open participant={participant} position={{ place: 2, gap: '+03:42' }}
    freshness={[{ state: 'offline', children: 'Нет соединения' }, { state: 'stale', children: 'Обновлено 48 минут назад' }]}
    route={[{ id: 'cp1', index: 1, title: 'Старт — КП-1 — 42 км', time: '08:30', status: 'Пройден', onSelect: onRoute }]}
    photoAction={{ label: '15 фото', onOpen: onPhotos }} onShare={onShare} onClose={onClose} /></AppProviders>);
  expect(await screen.findByRole('dialog', { name: 'Участник №14' })).toBeVisible();
  expect(screen.getByText('Алиса Иванова')).toBeVisible();
  expect(screen.getByText('2 место')).toBeVisible();
  expect(screen.getAllByRole('status')).toHaveLength(2);
  await user.click(screen.getByRole('button', { name: /Старт — КП-1/ }));
  expect(onRoute).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button', { name: 'Поделиться' }));
  expect(onShare).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button', { name: '15 фото' }));
  expect(onPhotos).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button', { name: 'Болею за' }));
  expect(participant.onSupportToggle).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button', { name: 'Свернуть' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});
it('handles empty route, no photos and controlled closing', async () => {
  const props = { participant, position: { place: 1, gap: '00:00' }, freshness: [], route: [], onShare: vi.fn(), onClose: vi.fn() };
  const { rerender } = render(<AppProviders><ParticipantSheet {...props} open /></AppProviders>);
  expect(screen.queryByRole('button', { name: /фото/ })).not.toBeInTheDocument();
  rerender(<AppProviders><ParticipantSheet {...props} open={false} /></AppProviders>);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
