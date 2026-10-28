import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import { RaceTabs, type RaceTabsProps } from '../components/RaceTabs';

export const disciplineOptions = [
  { value: 'all', label: 'Все' }, { value: 'sled8', label: 'Нарта, 8 собак' },
  { value: 'sled8plus', label: 'Нарта, 8+ собак' }, { value: 'ski2', label: 'Лыжи, 2 собаки' },
];
const meta = { tags: ['figma-unverified'],
  title: 'Компоненты из VKUI/Tabs', component: RaceTabs,
  args: { tab: 'all', discipline: 'all', options: disciplineOptions, mineCount: 3, onTabChange: fn(), onDisciplineChange: fn() },
  render: function Render(args) {
    const [, update] = useArgs<RaceTabsProps>();
    return <RaceTabs {...args} onTabChange={(tab) => { args.onTabChange(tab); update({ tab }); }} onDisciplineChange={(discipline) => { args.onDisciplineChange(discipline); update({ discipline }); }} />;
  },
  parameters: { fixtureWidth: 360, canvasPadding: 0, figma: { nodeId: '339:7873', status: 'Не проверено' }, docs: { description: { component: "Не проверено. Figma 339:7873. 360 × 48. Есть пять вариантов Figma, подробные свойства ограничены лимитом MCP. Полный аудит: docs/UI_KIT_FIGMA_AUDIT.md." } } },
} satisfies Meta<typeof RaceTabs>;
export default meta;
type Story = StoryObj<typeof meta>;
export const All: Story = { name: 'Все дисциплины' };
export const Sled8: Story = { name: 'Нарта, 8 собак', args: { discipline: 'sled8' } };
export const Sled8Plus: Story = { name: 'Нарта, 8+ собак', args: { discipline: 'sled8plus' } };
export const Ski: Story = { name: 'Лыжи, 2 собаки', args: { discipline: 'ski2' } };
export const Mine: Story = { name: 'Мои', args: { tab: 'mine' } };
export const NoSupported: Story = { name: 'Дополнительно — Нет поддерживаемых', args: { mineCount: 0 } };
