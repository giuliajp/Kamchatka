import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { EventCard } from '../components/EventCard';
const meta = { parameters: { figma: {"nodeId": "352:8418", "status": "Расхождение"}, docs: { description: { component: "Расхождение. Figma 352:8418. 328 × 186, правая колонка 256, изображение 232 × 88 с исходным crop. Исходные фото/иконка локальны; Gotham Pro отсутствует. Полный аудит: docs/UI_KIT_FIGMA_AUDIT.md." } } }, tags: ['figma-mismatch'], title: 'Компоненты созданные в этом документе/Event card', component: EventCard,
  args: { title: 'Старт этапа 3', category: 'Гонка', categoryIconUrl: '/figma/352-8418/b5bbd.svg', photoUrl: '/figma/352-8418/b9ffe.png', time: '08:00 -\n08:00', location: 'Эссо • Стартовая площадка', live: true, onOpen: fn() },
} satisfies Meta<typeof EventCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Live: Story = { name: 'Идёт сейчас' };
export const Scheduled: Story = { name: 'По расписанию', args: { live: false } };
export const WithImage: Story = { name: 'С изображением', args: { photoUrl: '/figma/352-8418/b9ffe.png' } };
export const LongTitle: Story = { name: 'Дополнительно — Длинное название', args: { title: 'Торжественная церемония награждения участников гонки на собачьих упряжках', location: 'Петропавловск-Камчатский городской округ · Центральная площадь' } };

export const WithoutImage: Story = { name: 'Дополнительно — без фотографии', args: { photoUrl: undefined } };
