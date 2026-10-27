import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import { SupportButton, type SupportButtonProps } from '../components/SupportButton';

const meta = { tags: ['figma-mismatch'],
  title: 'Компоненты из VKUI/Buttons/Болею за', component: SupportButton,
  args: { selected: false, loading: false, disabled: false, onToggle: fn() },
  render: function Render(args) {
    const [, updateArgs] = useArgs<SupportButtonProps>();
    return <SupportButton {...args} onToggle={() => { args.onToggle(); updateArgs({ selected: !args.selected }); }} />;
  },
  parameters: { figma: { nodeId: '339:7950', status: 'Расхождение' }, docs: { description: { component: "Расхождение. Figma 339:7950. Группа Болею за / Поделиться — 327 × 44. Исходные иконки получены; оформление ещё штатное VKUI. Полный аудит: docs/UI_KIT_FIGMA_AUDIT.md." } } },
} satisfies Meta<typeof SupportButton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { name: 'Не поддерживаю' };
export const Selected: Story = { name: 'Поддерживаю', args: { selected: true } };
export const Loading: Story = { name: 'Сохранение', args: { loading: true } };
export const Disabled: Story = { name: 'Недоступна', args: { disabled: true } };
