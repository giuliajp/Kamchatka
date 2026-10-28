import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../src/app/AppProviders';
import { RacePanelHeader } from '../src/components/RacePanelHeader';

describe('RacePanelHeader', () => {
  it('shows the supplied heading and three named actions', () => {
    const actions = { onBack: vi.fn(), onMenu: vi.fn(), onClose: vi.fn() };
    const { rerender } = render(
      <AppProviders><RacePanelHeader title="Гонка Авача 2027" {...actions} /></AppProviders>,
    );

    expect(screen.getByRole('heading', { name: 'Гонка Авача 2027', level: 1 })).toBeVisible();
    expect(screen.getAllByRole('button').map((button) => button.getAttribute('aria-label')))
      .toEqual(['Назад', 'Меню', 'Закрыть']);

    const title = 'Гонка Авача 2027 — очень длинное название соревнований на Камчатке';
    rerender(<AppProviders><RacePanelHeader title={title} {...actions} /></AppProviders>);
    expect(screen.getByRole('heading', { name: title, level: 1 })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Гонка Авача 2027' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(3);
    Object.values(actions).forEach((action) => expect(action).not.toHaveBeenCalled());
  });

  it.each([
    ['Назад', 'onBack'],
    ['Меню', 'onMenu'],
    ['Закрыть', 'onClose'],
  ] as const)('%s invokes only its supplied callback', async (name, actionName) => {
    const user = userEvent.setup();
    const actions = { onBack: vi.fn(), onMenu: vi.fn(), onClose: vi.fn() };
    render(<AppProviders><RacePanelHeader title="Гонка Авача 2027" {...actions} /></AppProviders>);

    await user.click(screen.getByRole('button', { name }));
    Object.entries(actions).forEach(([key, action]) => {
      expect(action).toHaveBeenCalledTimes(key === actionName ? 1 : 0);
    });
  });

  it('keeps keyboard order and supports Enter, Space and reverse focus traversal', async () => {
    const user = userEvent.setup();
    const actions = { onBack: vi.fn(), onMenu: vi.fn(), onClose: vi.fn() };
    render(<AppProviders><RacePanelHeader title="Гонка Авача 2027" {...actions} /></AppProviders>);

    for (const name of ['Назад', 'Меню', 'Закрыть']) {
      await user.tab();
      expect(screen.getByRole('button', { name })).toHaveFocus();
      await user.keyboard('{Enter}');
    }
    Object.values(actions).forEach((action) => expect(action).toHaveBeenCalledTimes(1));

    await user.keyboard(' ');
    expect(actions.onClose).toHaveBeenCalledTimes(2);
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Меню' })).toHaveFocus();
    await user.keyboard(' ');
    expect(actions.onMenu).toHaveBeenCalledTimes(2);
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Назад' })).toHaveFocus();
    await user.keyboard(' ');
    expect(actions.onBack).toHaveBeenCalledTimes(2);
  });
});
