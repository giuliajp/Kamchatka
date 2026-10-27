import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { AppProviders } from '../src/app/AppProviders';
import { Checkpoint } from '../src/components/Checkpoint';
it('shows the checkpoint label and activates it with the keyboard', async () => {
  const onSelect = vi.fn(); const user = userEvent.setup();
  render(<AppProviders><Checkpoint label="КП-2" onSelect={onSelect} /></AppProviders>);
  await user.tab();
  expect(screen.getByRole('button', { name: 'КП-2' })).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(onSelect).toHaveBeenCalledTimes(1);
});
