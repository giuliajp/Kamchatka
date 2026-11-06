import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { AppProviders } from '../src/app/AppProviders';
import { ParticipantSheet } from '../src/components/ParticipantSheet';
import { displayName, present } from '../src/api/client';
import { dogsLabel } from '../src/api/format';
import { fixtureResponse, mockApi, stage } from './fixtures';

it('shows names and discipline labels as in the mockups without touching unknown values', () => {
  expect(displayName('Иванова Алиса Петровна')).toBe('Алиса Иванова');
  expect(displayName('Иван')).toBe('Иван');
  expect(present({ code: 'sled_8plus', name: 'Нарта — длинная дистанция, более 8 собак' }).name).toBe('Нарта, 8+ собак');
  expect(present({ code: 'other', name: 'Своя дисциплина' }).name).toBe('Своя дисциплина');
});

it('lists checkpoint segments, the current segment and mandatory stops like the mockup', async () => {
  const live = { ...stage, checkpoints: [...stage.checkpoints,
    { ...stage.checkpoints[0], id: 301, order_index: 2, role: 'checkpoint' as const, name: 'Перевал', label: null, km_from_start: null },
    { ...stage.checkpoints[0], id: 302, order_index: 3, role: 'finish' as const, name: 'Финиш', label: 'Финиш', km_from_start: 40 }] };
  const passes = [
    { stage_id: 103, stage_number: 3, stage_checkpoint_id: 300, order_index: 1, role: 'checkpoint', label: null, name: 'Северный', km_from_start: null,
      required_rest_minutes: 30, arrived_at: '2026-10-27T03:00:00Z', departed_at: null },
    { stage_id: 103, stage_number: 3, stage_checkpoint_id: 301, order_index: 2, role: 'checkpoint', label: null, name: 'Перевал', km_from_start: 20,
      required_rest_minutes: 0, arrived_at: '2026-10-27T05:00:00Z', departed_at: null },
  ];
  mockApi(url => url.includes('/checkpoint-passes') ? passes : fixtureResponse(url));
  render(<AppProviders><ParticipantSheet participantId={501} entryId={9001} stage={live} threshold={45} onClose={vi.fn()} /></AppProviders>);
  expect(await screen.findByText('Старт - Северный')).toBeVisible();
  expect(screen.getByText('Северный - Перевал · 20 км')).toBeVisible();
  expect(screen.getByText('Перевал - Финиш · 40 км')).toBeVisible();
  expect(screen.getByText('•Проходит')).toBeVisible();
  expect(screen.getByText('Остановка')).toBeVisible();
  expect(screen.getByText('•Идёт')).toBeVisible();
});

it('shows the next unnamed checkpoint without a distance', async () => {
  const live = { ...stage, checkpoints: [...stage.checkpoints,
    { ...stage.checkpoints[0], id: 305, order_index: 5, role: 'checkpoint' as const, name: 'Распадок', label: null, km_from_start: null }] };
  mockApi(url => url.includes('/checkpoint-passes') ? [{ stage_id: 103, stage_number: 3, stage_checkpoint_id: 300, order_index: 1, role: 'checkpoint',
    label: 'КП-1', name: 'Северный', km_from_start: 10, required_rest_minutes: 0, arrived_at: '2026-10-27T03:00:00Z', departed_at: '2026-10-27T03:10:00Z' }] : fixtureResponse(url));
  render(<AppProviders><ParticipantSheet participantId={501} entryId={9001} stage={live} threshold={45} onClose={vi.fn()} /></AppProviders>);
  expect(await screen.findByText('КП-1 - Распадок')).toBeVisible();
});

it('shows a penalty without penalty time as a fact only', async () => {
  const { person } = await import('./fixtures');
  mockApi(url => url.endsWith('/participants/501') ? { ...person, races: person.races.map(race => ({ ...race,
    penalties: [{ seconds: 0, time: '00:00:00', reason: 'Предупреждение', rule_reference: null }] })) } : fixtureResponse(url));
  render(<AppProviders><ParticipantSheet participantId={501} entryId={9001} stage={stage} threshold={45} onClose={vi.fn()} /></AppProviders>);
  expect(await screen.findByText('Без штрафного времени · Предупреждение')).toBeVisible();
});

it('declines the dog count in Russian', () => {
  expect([1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 101].map(dogsLabel)).toEqual(['1 собака', '2 собаки', '4 собаки', '5 собак', '11 собак',
    '12 собак', '14 собак', '21 собака', '22 собаки', '25 собак', '101 собака']);
});
