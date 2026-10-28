import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { AppProviders } from '../src/app/AppProviders';
import { RaceTabs } from '../src/components/RaceTabs';

const options = [{ value: 'all', label: 'Все' }, { value: 'sled', label: 'Нарта, 8 собак' }];
it('opens disciplines, selects one, closes the list and reports the all tab', async () => {
  const user = userEvent.setup();
  const onDisciplineChange = vi.fn();
  const onTabChange = vi.fn();
  render(<AppProviders><RaceTabs tab="mine" discipline="all" options={options} mineCount={3} onTabChange={onTabChange} onDisciplineChange={onDisciplineChange} /></AppProviders>);
  expect(screen.getByRole('tab', { name: /Мои/ })).toHaveAttribute('aria-selected', 'true');
  await user.click(screen.getByRole('tab', { name: 'Дисциплина: Все' }));
  const dialog = await screen.findByRole('dialog', { name: 'Выбор дисциплины' });
  await user.click(within(dialog).getByRole('radio', { name: 'Нарта, 8 собак' }));
  expect(onDisciplineChange).toHaveBeenCalledExactlyOnceWith('sled');
  expect(onTabChange).toHaveBeenCalledExactlyOnceWith('all');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('selects mine by keyboard, supports zero count and falls back for an unknown discipline', async () => {
  const user = userEvent.setup();
  const onTabChange = vi.fn();
  render(<AppProviders><RaceTabs tab="all" discipline="missing" options={options} mineCount={0} onTabChange={onTabChange} onDisciplineChange={vi.fn()} /></AppProviders>);
  expect(screen.getByRole('tab', { name: 'Дисциплина' })).toHaveAttribute('aria-selected', 'true');
  await user.click(screen.getByRole('tab', { name: 'Мои' }));
  await user.keyboard('{Enter}');
  expect(onTabChange).toHaveBeenCalledWith('mine');
});
it('closes the discipline menu on Escape and restores focus', async () => {
  const user = userEvent.setup();
  render(<AppProviders><RaceTabs tab="all" discipline="all" options={options} mineCount={0} onTabChange={vi.fn()} onDisciplineChange={vi.fn()} /></AppProviders>);
  const tab = screen.getByRole('tab', { name: 'Дисциплина: Все' });
  await user.tab();
  expect(tab).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(await screen.findByRole('dialog')).toBeVisible();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(tab).toHaveFocus();
});
it('returns from mine to all when choosing the already selected discipline', async () => {
  const user = userEvent.setup(); const onTabChange = vi.fn(); const onDisciplineChange = vi.fn();
  render(<AppProviders><RaceTabs tab="mine" discipline="all" options={options} mineCount={3} onTabChange={onTabChange} onDisciplineChange={onDisciplineChange} /></AppProviders>);
  await user.click(screen.getByRole('tab', { name: 'Дисциплина: Все' }));
  await user.click(screen.getByRole('radio', { name: 'Все' }));
  expect(onTabChange).toHaveBeenCalledExactlyOnceWith('all');
  expect(onDisciplineChange).toHaveBeenCalledExactlyOnceWith('all');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
