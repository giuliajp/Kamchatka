import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tabbar, TabbarItem } from '@vkontakte/vkui';
import { Icon28PlaceOutline, Icon28UsersOutline, Icon28CupOutline, Icon28CalendarOutline, Icon28MenuOutline } from '@vkontakte/icons';
import { fn } from 'storybook/test';
const meta = { parameters: { figma: {"nodeId": "104:1334", "status": "Не проверено"}, docs: { description: { component: "Не проверено. Figma 104:1334. 10 вариантов: 5 разделов × Active/Inactive; размер каждого 72 × 48. Иконки пока из рабочего кода. Полный аудит: docs/UI_KIT_FIGMA_AUDIT.md." } } }, tags: ['figma-unverified'], title: 'Компоненты созданные в этом документе/Tab Bar Item', component: TabbarItem,
 args: { label: 'Карта', children: <Icon28PlaceOutline />, selected: false, onClick: fn() },
 decorators: [(Story) => <nav aria-label="Пример пункта навигации" style={{ width: 72 }}><Tabbar mode="vertical" style={{ position: 'relative' }}><Story /></Tabbar></nav>],
} satisfies Meta<typeof TabbarItem>;
export default meta;
type Story = StoryObj<typeof meta>;
export const MapInactive: Story = { name: 'State=Inactive, Name=map', args: { label: 'Карта', children: <Icon28PlaceOutline />, selected: false } };
export const MapActive: Story = { name: 'State=Active, Name=map', args: { label: 'Карта', children: <Icon28PlaceOutline />, selected: true } };
export const ParticipantsInactive: Story = { name: 'State=Inactive, Name=participants', args: { label: 'Участники', children: <Icon28UsersOutline />, selected: false } };
export const ParticipantsActive: Story = { name: 'State=Active, Name=participants', args: { label: 'Участники', children: <Icon28UsersOutline />, selected: true } };
export const ResultsInactive: Story = { name: 'State=Inactive, Name=results', args: { label: 'Результаты', children: <Icon28CupOutline />, selected: false } };
export const ResultsActive: Story = { name: 'State=Active, Name=results', args: { label: 'Результаты', children: <Icon28CupOutline />, selected: true } };
export const ProgrammeInactive: Story = { name: 'State=Inactive, Name=programme', args: { label: 'Программа', children: <Icon28CalendarOutline />, selected: false } };
export const ProgrammeActive: Story = { name: 'State=Active, Name=programme', args: { label: 'Программа', children: <Icon28CalendarOutline />, selected: true } };
export const OtherInactive: Story = { name: 'State=Inactive, Name=other', args: { label: 'Ещё', children: <Icon28MenuOutline />, selected: false } };
export const OtherActive: Story = { name: 'State=Active, Name=other', args: { label: 'Ещё', children: <Icon28MenuOutline />, selected: true } };
