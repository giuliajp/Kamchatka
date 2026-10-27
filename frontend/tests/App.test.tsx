import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { App } from '../src/App';

it('starts on the map with explicit demo context and navigation', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Гонка Авача 2027' })).toBeVisible();
  expect(screen.getByText('Демонстрационные данные')).toBeVisible();
  expect(screen.getByRole('region', { name: /Карта маршрута/ })).toBeVisible();
  expect(screen.getByRole('navigation', { name: 'Разделы гонки' })).toBeVisible();
});
