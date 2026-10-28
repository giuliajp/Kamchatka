import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { AppProviders } from '../src/app/AppProviders';
import { StageListItem } from '../src/components/StageListItem';
it('shows a selectable future stage and current selection', async () => {
  const onClick = vi.fn();
  const user = userEvent.setup();
  const { rerender } = render(<AppProviders><StageListItem label="Этап 4," details="начнётся 10.02 09:00" upcoming onClick={onClick} /></AppProviders>);
  const option = screen.getByRole('option', { name: 'Этап 4, начнётся 10.02 09:00' });
  expect(option).not.toHaveAttribute('aria-disabled', 'true');
  await user.click(option);
  expect(onClick).toHaveBeenCalledTimes(1);
  rerender(<AppProviders><StageListItem label="Этап 3," details="продолжается" selected /></AppProviders>);
  expect(screen.getByRole('option', { name: 'Этап 3, продолжается' })).toHaveAttribute('aria-selected', 'true');
});
