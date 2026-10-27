import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { TopParticipantsCard } from '../components/TopParticipantsCard';
const meta = { parameters: { figma: {"nodeId": "317:14413", "status": "Не проверено"}, docs: { description: { component: "Не проверено. Figma 317:14413. Default 122:9052 — 211 × 104; alternative 317:14414 — 280 × 104. Точные свойства недоступны. Полный аудит: docs/UI_KIT_FIGMA_AUDIT.md." } } }, tags: ['figma-unverified'], title: 'Компоненты созданные в этом документе/Top 3 card', component: TopParticipantsCard,
  args: { title: 'Нарта, 8+ собак: топ 3', entries: [
    { id: 'alice', place: 1, number: '14', label: 'Алиса Филимонова', time: '3:12:45' },
    { id: 'ivan', place: 2, number: '07', label: 'Иван Иванов', time: '+3:45' },
    { id: 'roman', place: 3, number: '22', label: 'Роман Кузнецов', time: '+6:45' },
  ], onSelect: fn() },
} satisfies Meta<typeof TopParticipantsCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Top3: Story = { name: 'Топ 3' };
export const Leaders: Story = { name: 'Лидеры по дисциплинам', args: { title: 'Лидеры по дисциплинам', entries: [
  { id: 'alice', number: '14', label: 'Нарта, 8 собак' }, { id: 'ivan', number: '07', label: 'Нарта, 8+ собак' }, { id: 'roman', number: '22', label: 'Лыжи, 2 собаки' },
] } };
export const Position: Story = { name: 'Позиция участника', args: { title: 'Нарта, 8+ собак', entries: [{ id: 'alice', place: 1, number: '14', label: 'Алиса Филимонова', time: '3:12:45' }] } };
export const Empty: Story = { name: 'Дополнительно — Нет результатов', args: { entries: [] } };
