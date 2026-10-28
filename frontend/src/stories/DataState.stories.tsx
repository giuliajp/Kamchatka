import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { DataState } from '../components/DataState';

const meta = {
  title: 'Компоненты созданные в этом документе/Дополнительные компоненты/DataState', component: DataState,
  parameters: { docs: { description: { component: 'Загрузка через skeleton, отсутствие опубликованных данных и ошибка с повтором. Для error обязателен onRetry.' } } },
} satisfies Meta<typeof DataState>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Loading: Story = { name: 'Загрузка', args: { status: 'loading' } };
export const Empty: Story = { name: 'Пустые данные', args: { status: 'empty' } };
export const Error: Story = { name: 'Ошибка и повтор', args: { status: 'error', onRetry: fn() } };
