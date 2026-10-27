import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { DataFreshness } from '../components/DataFreshness';

const meta = {
  title: 'Компоненты созданные в этом документе/Дополнительные компоненты/DataFreshness', component: DataFreshness,
  args: { onRetry: fn(), lastUpdated: '15 октября, 14:20' },
  parameters: { docs: { description: { component: 'Offline относится к соединению пользователя, stale к последней координате. Флаги независимы и поступают извне. Время передаётся готовой подписью с нужным часовым поясом; компонент не вычисляет порог устаревания.' } } },
} satisfies Meta<typeof DataFreshness>;
export default meta;
type Story = StoryObj<typeof meta>;
export const OfflineCached: Story = { name: 'Нет сети, есть кэш', args: { offline: true } };
export const OfflineEmpty: Story = { name: 'Нет сети и кэша', args: { offline: true, hasCachedData: false, lastUpdated: undefined } };
export const Stale: Story = { name: 'Координата устарела', args: { stale: true } };
export const OfflineAndStale: Story = { name: 'Нет сети и устарела координата', args: { offline: true, stale: true } };
export const UnknownTime: Story = { name: 'Время неизвестно', args: { stale: true, lastUpdated: undefined } };
export const Fresh: Story = { name: 'Предупреждения отсутствуют', args: { offline: false, stale: false } };
