import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { AppProviders } from '../src/app/AppProviders';
import { TopParticipantsCard } from '../src/components/TopParticipantsCard';
it('shows rankings and reports which participant was opened', async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  render(<AppProviders><TopParticipantsCard title="Нарта, 8+ собак: топ 3" entries={[
    { id: 'alice', number: '14', label: 'Алиса Филимонова', place: 1, time: '3:12:45' },
    { id: 'ivan', number: '07', label: 'Иван Иванов', place: 2, time: '+3:45' },
  ]} onSelect={onSelect} /></AppProviders>);
  const card = screen.getByRole('region', { name: 'Нарта, 8+ собак: топ 3' });
  expect(within(card).getByText('3:12:45')).toBeVisible();
  expect(within(card).getByText('№14')).toBeVisible();
  await user.click(within(card).getByRole('button', { name: /Алиса Филимонова/ }));
  expect(onSelect).toHaveBeenCalledExactlyOnceWith('alice');
});
it('shows discipline leaders without ranks and handles an empty list', () => {
  const { rerender } = render(<AppProviders><TopParticipantsCard title="Лидеры по дисциплинам" entries={[{ id: 'a', number: '14', label: 'Нарта, 8 собак' }]} onSelect={vi.fn()} /></AppProviders>);
  expect(screen.getByText('Нарта, 8 собак')).toBeVisible();
  rerender(<AppProviders><TopParticipantsCard title="Лидеры по дисциплинам" entries={[]} onSelect={vi.fn()} /></AppProviders>);
  expect(screen.getByText('Результатов пока нет')).toBeVisible();
});
