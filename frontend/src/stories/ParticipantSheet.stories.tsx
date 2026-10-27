import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@vkontakte/vkui';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import { ParticipantSheet, type ParticipantSheetProps } from '../components/ParticipantSheet';
const meta = { parameters: { figma: {"nodeId": "339:7885", "status": "Не проверено"}, docs: { description: { component: "Не проверено. Figma 339:7885. В Figma это заголовок зоны Participant bottom sheet, не готовый контейнер. Существующая ModalPage — дополнительная рабочая композиция, точное соответствие не заявлено. Полный аудит: docs/UI_KIT_FIGMA_AUDIT.md." } } }, tags: ['figma-unverified'], title: 'Компоненты созданные в этом документе/Participant bottom sheet', component: ParticipantSheet,
  args: { open: true, participant: { name: 'Алиса Иванова', number: 14, region: 'Камчатский край', discipline: 'Ездовые лайки | 12 собак', supported: false, onSupportToggle: fn() },
    position: { place: 2, gap: '+03:42' }, freshness: [{ state: 'position', children: 'Положение на 14:36' }],
    route: [{ id: 'cp1', index: 1, title: 'Старт — КП-1 — 42 км', time: '08:30', status: 'Пройден', onSelect: fn() }],
    photoAction: { label: '15 фото', onOpen: fn() }, onShare: fn(), onClose: fn() },
  render: function Render(args) {
    const [, update] = useArgs<ParticipantSheetProps>();
    return <><Button onClick={() => update({ open: true })}>Открыть участника</Button><ParticipantSheet {...args}
      participant={{ ...args.participant, onSupportToggle: () => { args.participant.onSupportToggle(); update({ participant: { ...args.participant, supported: !args.participant.supported } }); } }}
      onClose={() => { args.onClose(); update({ open: false }); }} /></>;
  },
} satisfies Meta<typeof ParticipantSheet>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Open: Story = { name: 'Участник и маршрут' };
export const Offline: Story = { name: 'Offline и устаревшая координата', args: { freshness: [{ state: 'offline', children: 'Нет соединения. Данные на 14:36' }, { state: 'stale', children: 'Обновлено 48 минут назад' }] } };
export const WithoutPhotos: Story = { name: 'Дополнительно — Без фотографий и маршрута', args: { photoAction: undefined, route: [] } };
