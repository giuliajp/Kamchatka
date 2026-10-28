import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { AppProviders } from '../src/app/AppProviders';
import { RaceHeader } from '../src/components/RaceHeader';
it('composes header actions, stages and participant filters without sharing handlers', async () => {
  const user = userEvent.setup();
  const onBack = vi.fn(); const onStage = vi.fn(); const onTab = vi.fn();
  render(<AppProviders><RaceHeader
    header={{ title: 'Гонка Авача 2027', onBack, onMenu: vi.fn(), onClose: vi.fn() }}
    stage={{ value: '3', options: [{ value: '3', label: 'Этап 3,', details: 'продолжается' }, { value: '4', label: 'Этап 4,', details: 'завтра', upcoming: true }], onChange: onStage }}
    filters={{ tab: 'all', discipline: 'all', options: [{ value: 'all', label: 'Все' }], mineCount: 3, onTabChange: onTab, onDisciplineChange: vi.fn() }}
  /></AppProviders>);
  expect(screen.getByRole('heading', { name: 'Гонка Авача 2027' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Назад' }));
  expect(onBack).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('combobox', { name: 'Этап гонки' }));
  await user.click(screen.getByRole('option', { name: 'Этап 4, завтра' }));
  expect(onStage).toHaveBeenCalledExactlyOnceWith('4');
  await user.click(screen.getByRole('tab', { name: /Мои/ }));
  expect(onTab).toHaveBeenCalledExactlyOnceWith('mine');
});
