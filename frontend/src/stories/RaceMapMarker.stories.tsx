import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { RaceMapMarker } from '../components/RaceMapMarker';
const meta = { tags: ['figma-mismatch'], title: 'Компоненты созданные в этом документе/Map points', component: RaceMapMarker,
  args: { number: '2', position: 'confirmed', supported: false, leader: false, onSelect: fn() },
  parameters: { figma: { nodeId: '276:5012', status: 'Расхождение' }, docs: { description: { component: "Расхождение. Figma 276:5012. 13 вариантов Figma, включая кластер. Размеры 44/36/28, контуры и значки экспортированы локально. Gotham Pro отсутствует. Комбинации лидер + stale отсутствуют в макете и отмечены дополнительными. Полный аудит: docs/UI_KIT_FIGMA_AUDIT.md." } } },
} satisfies Meta<typeof RaceMapMarker>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Confirmed: Story = { name: 'Подтверждённая позиция' };
export const Estimated: Story = { name: 'Расчётная позиция', args: { position: 'estimated' } };
export const Stale: Story = { name: 'Устаревшая позиция', args: { position: 'stale' } };
export const Supported: Story = { name: 'Мой участник', args: { number: '21', supported: true } };
export const Leader: Story = { name: 'Лидер', args: { leader: true } };
export const ConfirmedSupportedLeader: Story = { name: 'Мой участник — лидер', args: { position: 'confirmed', number: '21', supported: true, leader: true } };
export const EstimatedLeader: Story = { name: 'Расчётная — лидер', args: { position: 'estimated', supported: false, leader: true } };
export const EstimatedSupported: Story = { name: 'Мой участник — расчётная', args: { position: 'estimated', number: '21', supported: true, leader: false } };
export const EstimatedSupportedLeader: Story = { name: 'Мой лидер — расчётная', args: { position: 'estimated', number: '21', supported: true, leader: true } };
export const StaleLeader: Story = { name: 'Дополнительно — Лидер — устаревшая', args: { position: 'stale', supported: false, leader: true } };
export const StaleSupported: Story = { name: 'Мой участник — устаревшая', args: { position: 'stale', number: '21', supported: true, leader: false } };
export const StaleSupportedLeader: Story = { name: 'Дополнительно — Мой лидер — устаревшая', args: { position: 'stale', number: '21', supported: true, leader: true } };

export const StaleAlternative: Story = { name: 'Позиция устарела — альт версия', args: { position: 'stale', staleVariant: 'live' } };
export const SupportedStaleAlternative: Story = { name: 'Мой участник — устарела, альт версия', args: { number: '21', supported: true, position: 'stale', staleVariant: 'live' } };
