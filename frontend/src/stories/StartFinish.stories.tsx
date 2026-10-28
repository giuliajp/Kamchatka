import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@vkontakte/vkui';
import { Icon24FlagStart, Icon24FlagFinish } from '@vkontakte/icons';
import { fn } from 'storybook/test';
const meta = { tags: ['figma-unverified'], title: 'Компоненты созданные в этом документе/start_finish_point', component: Button,
 args: { mode: 'tertiary', size: 's', onClick: fn(), children: 'Старт', before: <Icon24FlagStart /> },
 parameters: { figma: { nodeId: '317:17537', status: 'Не проверено' }, docs: { description: { component: "Не проверено. Figma 317:17537. Старт 64 × 24, финиш 74 × 24. Пока стандартные Button, точные свойства и ассет флага недоступны. Полный аудит: docs/UI_KIT_FIGMA_AUDIT.md." } } },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Start: Story = { name: 'Type=start' };
export const Finish: Story = { name: 'Type=finish', args: { children: 'Финиш', before: <Icon24FlagFinish /> } };
