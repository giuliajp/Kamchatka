import type { Meta, StoryObj } from '@storybook/react-vite';
import { AdaptivityProvider } from '@vkontakte/vkui';
import { fn } from 'storybook/test';
import { RacePanelHeader } from '../components/RacePanelHeader';
const meta = { tags: ['figma-mismatch'], title: 'Компоненты из VKUI/Panel header', component: RacePanelHeader,
  args: { title: 'Гонка Авача 2027', onBack: fn(), onMenu: fn(), onClose: fn() },
  decorators: [(Story) => <AdaptivityProvider density="regular"><Story /></AdaptivityProvider>],
  globals: { appearance: 'light', platform: 'android', viewport: { value: 'mobile360', isRotated: false } },
  parameters: { fixtureWidth: 360, canvasPadding: 0, figma: { nodeId: '339:7874', status: 'Расхождение' }, docs: { description: { component: "Расхождение. Figma 339:7874. 360 × 56. Gotham Pro Medium 16/20, tracking 0.1. В VKUI остаются отличия правой капсулы и типографики. Полный аудит: docs/UI_KIT_FIGMA_AUDIT.md." } } },
} satisfies Meta<typeof RacePanelHeader>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { name: 'Гонка Авача 2027' };
export const LongTitle: Story = { name: 'Дополнительно — Длинный заголовок', args: { title: 'Гонка Авача 2027 — соревнования на собачьих упряжках на Камчатке' } };
