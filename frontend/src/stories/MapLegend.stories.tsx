import type { Meta, StoryObj } from '@storybook/react-vite';
import { Flex, Text } from '@vkontakte/vkui';
import { RaceMapMarker } from '../components/RaceMapMarker';
import markerMeta from './RaceMapMarker.stories';
const meta = { ...markerMeta, parameters: { figma: {"nodeId": "339:7923", "status": "Не проверено"}, docs: { description: { component: "Не проверено. Figma 339:7923. Каждая строка легенды отдельно. Состав прочитан, точные параметры строк не получены. Полный аудит: docs/UI_KIT_FIGMA_AUDIT.md." } } }, tags: ['figma-unverified'],  title: 'Компоненты созданные в этом документе/legend',
 render: (args) => <Flex align="center" gap="m"><RaceMapMarker {...args} /><Text>{args.supported ? 'Мой участник' : 'Любой участник'}{args.leader ? ', лидер' : ''} — {{ confirmed: 'позиция подтверждена', estimated: 'расчётное время', stale: 'позиция устарела' }[args.position]}</Text></Flex>,
} satisfies Meta<typeof RaceMapMarker>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Confirmed: Story = { name: 'Любой участник' };
export const Leader: Story = { name: 'Лидер', args: { leader: true } };
export const Estimated: Story = { name: 'Расчётное время', args: { position: 'estimated' } };
export const EstimatedLeader: Story = { name: 'Лидер — расчётное время', args: { position: 'estimated', leader: true } };
export const Stale: Story = { name: 'Позиция устарела', args: { position: 'stale', staleVariant: 'live' } };
export const Supported: Story = { name: 'Мой участник', args: { number: '21', supported: true } };
export const SupportedLeader: Story = { name: 'Мой участник — лидер', args: { number: '21', supported: true, leader: true } };
export const SupportedEstimated: Story = { name: 'Мой участник — расчётное время', args: { number: '21', supported: true, position: 'estimated' } };
export const SupportedStale: Story = { name: 'Мой участник — устарела', args: { number: '21', supported: true, position: 'stale', staleVariant: 'live' } };
