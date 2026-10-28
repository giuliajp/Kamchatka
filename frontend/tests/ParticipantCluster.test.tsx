import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { AppProviders } from '../src/app/AppProviders';
import { ParticipantCluster } from '../src/components/ParticipantCluster';
it('shows the supplied count and opens the cluster by keyboard', async () => {
 const user = userEvent.setup(); const onSelect = vi.fn();
 render(<AppProviders><ParticipantCluster count={4} onSelect={onSelect} /></AppProviders>);
 const button = screen.getByRole('button', { name: '+4 — ещё участники на маршруте' });
 expect(button).toHaveTextContent('+4');
 await user.tab(); expect(button).toHaveFocus(); await user.keyboard('{Enter}');
 expect(onSelect).toHaveBeenCalledTimes(1);
});
