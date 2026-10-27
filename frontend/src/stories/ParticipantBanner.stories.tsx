import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ParticipantBanner } from '../components/ParticipantBanner';

const meta = { tags: ['figma-mismatch'],
  title: 'Компоненты из VKUI/Banner', component: ParticipantBanner,
  args: { name: 'Алиса Иванова', region: 'Камчатский край', discipline: 'Ездовые лайки | 12 собак', onOpen: fn() },
  parameters: { fixtureWidth: 328, canvasPadding: 16, figma: { nodeId: '339:7951', status: 'Расхождение' }, docs: { description: { component: "Расхождение. Figma 339:7951. 328 × 96, изображение 72, отступы/зазор 12. Настоящий VKUI Banner; исходное фото локально в story. Шрифты и типографика отличаются. Полный аудит: docs/UI_KIT_FIGMA_AUDIT.md." } } },
} satisfies Meta<typeof ParticipantBanner>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { name: 'Участник' };
export const WithPhoto: Story = { name: 'С фотографией', args: { photoUrl: '/figma/339-7951/14c71.png' } };
export const Disabled: Story = { name: 'Недоступен', args: { disabled: true } };
export const LongName: Story = { name: 'Дополнительно — Длинные подписи', args: { name: 'Александра Константинопольская', discipline: 'Гонка на собачьих упряжках, 8–12 собак, длинная дистанция' } };
