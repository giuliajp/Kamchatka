import type { Meta, StoryObj } from '@storybook/react-vite';
import leadersMeta, { Position } from './TopParticipantsCard.stories';
const meta = { ...leadersMeta, tags: ['figma-unverified'],  title: 'Компоненты созданные в этом документе/position',
 parameters: { figma: { nodeId: '317:14429', status: 'Не проверено' }, docs: { description: { component: "Не проверено. Figma 317:14429. Две строки: 119:8983 — 150 × 18, 317:14435 — 260 × 18. В каталоге временно существующая функциональная композиция; это НЕ точная строка Figma. Полный аудит: docs/UI_KIT_FIGMA_AUDIT.md." } } },
} satisfies Meta<typeof leadersMeta.component>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Current: Story = { ...Position, name: 'Рабочая версия — не сверено' };
