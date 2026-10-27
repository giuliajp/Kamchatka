import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent } from 'storybook/test';
import tabsMeta from './RaceTabs.stories';
const meta = { ...tabsMeta, parameters: { figma: {"nodeId": "339:7916", "status": "Расхождение"}, docs: { description: { component: "Расхождение. Figma 339:7916. 171 × 214, кнопка 171 × 34 и меню 171 × 172 с зазором 8. Текущая композиция VKUI требует отдельной сверки. Полный аудит: docs/UI_KIT_FIGMA_AUDIT.md." } } }, tags: ['figma-mismatch'],  title: 'Компоненты из VKUI/tab dropdown' } satisfies Meta<typeof tabsMeta.component>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Open: Story = { name: 'Меню дисциплин', play: async ({ canvas }) => { await userEvent.click(canvas.getByRole('tab', { name: 'Дисциплина: Все' })); } };
