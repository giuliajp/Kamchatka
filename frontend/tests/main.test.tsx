import { act, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { mockApi, race } from './fixtures';

describe('browser entry point', () => {
  it('reports a missing mount element', async () => {
    vi.resetModules();
    await expect(import('../src/main')).rejects.toThrow('Не найден элемент #root');
  }, 15000); // Cold import includes real VKUI and V8 coverage instrumentation.

  it('mounts the actual application', async () => {
    mockApi(() => ({ ...race, stages: [] }));
    vi.resetModules();
    const container = document.createElement('div');
    container.id = 'root';
    document.body.append(container);
    let appRoot: Awaited<typeof import('../src/main')>['appRoot'];
    await act(async () => { ({ appRoot } = await import('../src/main')); });
    expect(await screen.findByRole('heading', { name: race.name })).toBeInTheDocument();
    act(() => appRoot.unmount());
    container.remove();
  });
});
