import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@vkontakte/vkui';
import { Icon16Add, Icon24ChevronUp } from '@vkontakte/icons';
import { fn } from 'storybook/test';
const meta = { parameters: { figma: {"nodeId": "352:7182", "status": "Расхождение"}, docs: { description: { component: "Расхождение. Figma 352:7182. 15 фото — 94 × 28, иконка add_16; Свернуть 352:7955 — 101 × 28. Шрифт отсутствует, второй узел не прочитан подробно. Полный аудит: docs/UI_KIT_FIGMA_AUDIT.md." } } }, tags: ['figma-mismatch'], title: 'Компоненты из VKUI/Текстовые действия', component: Button,
 args: { mode: 'tertiary', size: 's', onClick: fn(), children: '15 фото', before: <Icon16Add /> },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Photos: Story = { name: '15 фото' };
export const Collapse: Story = { name: 'Свернуть', args: { children: 'Свернуть', before: undefined, after: <Icon24ChevronUp /> } };
