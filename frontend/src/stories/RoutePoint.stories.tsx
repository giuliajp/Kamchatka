import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { RoutePoint } from '../components/RoutePoint';
const meta = { parameters: { figma: {"nodeId": "173:2856", "status": "Расхождение"}, docs: { description: { component: "Расхождение. Figma 173:2856. 328 × 34, счётчик 24, gap 12, две строки. Параметры перенесены; Gotham Pro и Roboto не подключены локально. Полный аудит: docs/UI_KIT_FIGMA_AUDIT.md." } } }, tags: ['figma-mismatch'], title: 'Компоненты созданные в этом документе/Participant bottom sheet/route point', component: RoutePoint,
  args: { index: 1, title: 'Старт - КП-1 · 42 км', time: '08:30', status: 'Пройден', onSelect: fn() },
} satisfies Meta<typeof RoutePoint>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Passed: Story = { name: 'Участок маршрута' };
