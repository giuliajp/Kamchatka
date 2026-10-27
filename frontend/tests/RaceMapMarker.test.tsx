import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { AppProviders } from '../src/app/AppProviders';
import { RaceMapMarker } from '../src/components/RaceMapMarker';
it.each(['confirmed', 'estimated', 'stale'] as const)('exposes %s position and supports selection', async (position) => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  const { rerender } = render(<AppProviders><RaceMapMarker number="21" position={position} supported={false} leader={false} onSelect={onSelect} /></AppProviders>);
  const button = screen.getByRole('button', { name: /Участник 21/ });
  expect(button).toHaveTextContent('21');
  expect(button).toHaveAccessibleName(new RegExp({ confirmed: 'подтверждена', estimated: 'расчётная', stale: 'устарела' }[position]));
  await user.click(button);
  expect(onSelect).toHaveBeenCalledTimes(1);
  rerender(<AppProviders><RaceMapMarker number="21" position={position} supported leader onSelect={onSelect} /></AppProviders>);
  expect(screen.getByRole('button')).toHaveAccessibleName(/мой участник, лидер/);
  await user.keyboard('{Enter}');
  expect(onSelect).toHaveBeenCalledTimes(2);
});

// Each exported Figma marker variant must retain its own ring and badge asset.
it.each([
  [false, 'confirmed', false, 'clock', '039a1.svg', undefined],
  [true, 'confirmed', true, 'clock', '655cc.svg', '34c07.svg'],
  [false, 'estimated', true, 'clock', '7148f.png', '34c07.svg'],
  [true, 'estimated', false, 'clock', 'c4525.png', undefined],
  [false, 'stale', false, 'clock', 'a7e46.svg', '79812.svg'],
  [true, 'stale', false, 'clock', 'd17ac.svg', 'e3214.svg'],
  [false, 'stale', false, 'live', 'a7e46.svg', 'b2520.svg'],
  [true, 'stale', false, 'live', 'd17ac.svg', '8d565.svg'],
] as const)('shows the reference assets for supported=%s, %s, leader=%s, %s', (supported, position, leader, staleVariant, ring, badge) => {
  const { container } = render(<AppProviders><RaceMapMarker number="21" supported={supported} position={position} leader={leader} staleVariant={staleVariant} onSelect={vi.fn()} /></AppProviders>);
  const images = Array.from(container.querySelectorAll('img')).map((image) => image.getAttribute('src'));
  expect(images).toContain(`/figma/276-5012/${ring}`);
  if (badge) expect(images).toContain(`/figma/276-5012/${badge}`);
  expect(screen.getByRole('button')).toHaveTextContent('21');
});

it.each([false, true])('prioritizes the stale badge visually and retains leader semantics (supported=%s)', (supported) => {
  const { container } = render(<AppProviders><RaceMapMarker number="21" supported={supported} position="stale" leader onSelect={vi.fn()} /></AppProviders>);
  expect(screen.getByRole('button')).toHaveAccessibleName(/позиция устарела.*лидер/);
  expect(container.querySelector('img[src="/figma/276-5012/34c07.svg"]')).not.toBeInTheDocument();
  expect(container.querySelector(`img[src="/figma/276-5012/${supported ? 'e3214.svg' : '79812.svg'}"]`)).toBeInTheDocument();
});
