import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import { RaceHeader, type RaceHeaderProps } from '../components/RaceHeader';
const meta = { parameters: { fixtureWidth: 360, canvasPadding: 0, figma: {"nodeId": "108:8575", "status": "Не проверено"}, docs: { description: { component: "Не проверено. Figma 108:8575. Составная Panel Header 360 × 180; подробные свойства не прочитаны. Полный аудит: docs/UI_KIT_FIGMA_AUDIT.md." } } }, tags: ['figma-unverified'], title: 'Компоненты созданные в этом документе/Header Panel', component: RaceHeader,
  args: {
    header: { title: 'Гонка Авача 2027', onBack: fn(), onMenu: fn(), onClose: fn() },
    stage: { value: '3', options: [{ value: '2', label: 'Этап 2,', details: '08.02 09:00 - 18:00, завершен' }, { value: '3', label: 'Этап 3,', details: '09.02 09:00 - продолжается' }, { value: '4', label: 'Этап 4,', details: 'начнётся 10.02 09:00', upcoming: true }], onChange: fn() },
    filters: { tab: 'all', discipline: 'all', options: [{ value: 'all', label: 'Все' }, { value: 'sled8', label: 'Нарта, 8 собак' }, { value: 'sled8plus', label: 'Нарта, 8+ собак' }, { value: 'ski2', label: 'Лыжи, 2 собаки' }], mineCount: 3, onTabChange: fn(), onDisciplineChange: fn() },
  },
  render: function Render(args) {
    const [, update] = useArgs<RaceHeaderProps>();
    return <RaceHeader {...args}
      stage={{ ...args.stage, onChange: (value) => { args.stage.onChange(value); update({ stage: { ...args.stage, value } }); } }}
      filters={{ ...args.filters!, onTabChange: (tab) => { args.filters!.onTabChange(tab); update({ filters: { ...args.filters!, tab } }); },
        onDisciplineChange: (discipline) => { args.filters!.onDisciplineChange(discipline); update({ filters: { ...args.filters!, discipline, tab: 'all' } }); } }} />;
  },
} satisfies Meta<typeof RaceHeader>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { name: 'Шапка с фильтрами' };
