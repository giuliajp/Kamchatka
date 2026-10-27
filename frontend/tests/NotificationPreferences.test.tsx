import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { AppProviders } from '../src/app/AppProviders';
import { NotificationPreferences } from '../src/components/NotificationPreferences';
it('reports independent channel changes and waits for parent updates', async () => {
  const user = userEvent.setup();
  const onPushChange = vi.fn();
  const onVkChange = vi.fn();
  const { rerender } = render(<AppProviders><NotificationPreferences push vk={false} onPushChange={onPushChange} onVkChange={onVkChange} /></AppProviders>);
  const push = screen.getByRole('switch', { name: 'Push-уведомления на телефон' });
  const vk = screen.getByRole('switch', { name: 'VK уведомления' });
  expect(push).toBeChecked();
  expect(vk).not.toBeChecked();
  await user.click(push);
  expect(onPushChange).toHaveBeenCalledExactlyOnceWith(false);
  expect(onVkChange).not.toHaveBeenCalled();
  await user.click(vk);
  expect(onVkChange).toHaveBeenCalledExactlyOnceWith(true);
  rerender(<AppProviders><NotificationPreferences push={false} vk onPushChange={onPushChange} onVkChange={onVkChange} /></AppProviders>);
  expect(push).not.toBeChecked();
  expect(vk).toBeChecked();
});
it('blocks both channels while disabled', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<AppProviders><NotificationPreferences push={false} vk={false} disabled onPushChange={onChange} onVkChange={onChange} /></AppProviders>);
  for (const control of screen.getAllByRole('switch')) {
    expect(control).toBeDisabled();
    await user.click(control);
  }
  expect(onChange).not.toHaveBeenCalled();
});
