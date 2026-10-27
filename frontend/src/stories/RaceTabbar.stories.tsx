import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import { RaceTabbar, type RaceTabbarProps } from '../components/RaceTabbar';
const meta = { tags: ['figma-unverified'],
  title: 'Компоненты созданные в этом документе/Tabbar', component: RaceTabbar,
  args: { value: 'map', onChange: fn() },
  render: function Render(args) {
    const [, update] = useArgs<RaceTabbarProps>();
    return <RaceTabbar {...args} onChange={(value) => { args.onChange(value); update({ value }); }} />;
  },
  parameters: { fixtureWidth: 360, canvasPadding: 0, figma: { nodeId: '105:1414', status: 'Не проверено' }, docs: { description: { component: "Не проверено. Figma 105:1414. Tab Bar 360 × 72; подробные свойства недоступны из-за лимита MCP. Полный аудит: docs/UI_KIT_FIGMA_AUDIT.md." } } },
} satisfies Meta<typeof RaceTabbar>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Map: Story = { name: 'Карта' };
export const Participants: Story = { name: 'Участники', args: { value: 'participants' } };
export const Results: Story = { name: 'Результаты', args: { value: 'results' } };
export const Program: Story = { name: 'Программа', args: { value: 'program' } };
export const More: Story = { name: 'Ещё', args: { value: 'more' } };
