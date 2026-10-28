import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../src/app/AppProviders';
import { RaceStageSelect } from '../src/components/RaceStageSelect';

const options = [
  { value: 'stage-2', label: 'Этап 2,', details: '08.02 09:00 - 18:00, завершен' },
  { value: 'stage-3', label: 'Этап 3,', details: '09.02 09:00 - продолжается', upcoming: false },
  { value: 'stage-4', label: 'Этап 4,', details: 'начнётся 10.02 09:00', upcoming: true },
];
const activeLabel = 'Этап 3, 09.02 09:00 - продолжается';
const futureLabel = 'Этап 4, начнётся 10.02 09:00';

describe('RaceStageSelect', () => {
  it('shows the controlled value and opens and closes the stage list', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AppProviders><RaceStageSelect options={options} value="stage-3" onChange={onChange} /></AppProviders>);
    const select = screen.getByRole('combobox', { name: 'Этап гонки' });
    expect(select).toHaveValue(activeLabel);
    expect(select).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    await user.click(select);
    expect(select).toHaveAttribute('aria-expanded', 'true');
    const list = screen.getByRole('listbox');
    expect(within(list).getAllByRole('option')).toHaveLength(3);
    for (const option of within(list).getAllByRole('option')) {
      expect(option).not.toHaveAttribute('stagelabel');
    }
    expect(within(list).getByRole('option', { name: activeLabel })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Escape}');
    expect(select).toHaveAttribute('aria-expanded', 'false');
    expect(select).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('allows choosing a future stage without changing the value until the parent updates it', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <AppProviders><RaceStageSelect options={options} value="stage-3" onChange={onChange} /></AppProviders>,
    );
    const select = screen.getByRole('combobox', { name: 'Этап гонки' });
    await user.click(select);
    const future = within(screen.getByRole('listbox')).getByRole('option', { name: futureLabel });
    expect(future).not.toHaveAttribute('aria-disabled', 'true');
    await user.click(future);
    expect(onChange).toHaveBeenCalledExactlyOnceWith('stage-4');
    expect(select).toHaveAttribute('aria-expanded', 'false');
    expect(select).toHaveValue(activeLabel);

    rerender(<AppProviders><RaceStageSelect options={options} value="stage-4" onChange={onChange} /></AppProviders>);
    expect(select).toHaveValue(futureLabel);
  });

  it('selects a stage by keyboard and keeps focus on the control', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AppProviders><RaceStageSelect options={options} value="stage-3" onChange={onChange} /></AppProviders>);
    const select = screen.getByRole('combobox', { name: 'Этап гонки' });
    await user.tab();
    expect(select).toHaveFocus();
    await user.keyboard('{Enter}{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledExactlyOnceWith('stage-4');
    expect(select).toHaveFocus();
    expect(select).toHaveAttribute('aria-expanded', 'false');
  });

  it('blocks interaction when the entire control is disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AppProviders><RaceStageSelect options={options} value="stage-3" disabled onChange={onChange} /></AppProviders>);
    const select = screen.getByRole('combobox', { name: 'Этап гонки' });
    expect(select).toBeDisabled();
    await user.click(select);
    await user.tab();
    expect(select).not.toHaveFocus();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
