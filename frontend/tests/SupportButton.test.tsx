import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SupportButton } from '../src/components/SupportButton';

describe('SupportButton', () => {
  it('requests a change and leaves the selected state under parent control', async () => {
    const onToggle = vi.fn();
    render(<SupportButton selected={false} onToggle={onToggle} />);
    const button = screen.getByRole('button', { name: 'Болею за' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('supports selection and deselection by keyboard', async () => {
    function Harness() {
      const [selected, setSelected] = useState(false);
      return <SupportButton selected={selected} onToggle={() => setSelected(!selected)} />;
    }
    render(<Harness />);
    await userEvent.tab();
    expect(screen.getByRole('button')).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Вы болеете' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.keyboard(' ');
    expect(screen.getByRole('button', { name: 'Болею за' })).toHaveAttribute('aria-pressed', 'false');
  });

  it.each([
    { loading: true, disabled: false },
    { loading: false, disabled: true },
    { loading: true, disabled: true },
  ])('blocks repeated actions: %j', async ({ loading, disabled }) => {
    const onToggle = vi.fn();
    render(<SupportButton selected loading={loading} disabled={disabled} onToggle={onToggle} />);
    const button = screen.getByRole('button', { name: 'Вы болеете' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', String(loading));
    await userEvent.click(button);
    expect(onToggle).not.toHaveBeenCalled();
  });
});
