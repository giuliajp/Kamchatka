import type { Meta, StoryObj } from '@storybook/react-vite';
import { AdaptivityProvider } from '@vkontakte/vkui';
import { useArgs } from 'storybook/preview-api';
import { fn, userEvent, within } from 'storybook/test';
import { RaceStageSelect, type RaceStageOption, type RaceStageSelectProps } from '../components/RaceStageSelect';
const meta = { parameters: { fixtureWidth: 328, canvasPadding: 16, figma: {"nodeId": "339:7875", "status": "Расхождение"}, docs: { description: { component: "Расхождение. Figma 339:7875. 328 × 44. Данные Figma получены; Gotham Pro не установлен. Варианты меню сверены не полностью. Полный аудит: docs/UI_KIT_FIGMA_AUDIT.md." } } }, tags: ['figma-mismatch'], title: 'Компоненты из VKUI/Select', component: RaceStageSelect } satisfies Meta<typeof RaceStageSelect>;
export default meta;
const stages: RaceStageOption[] = [
  { value: 'stage-1', label: 'Этап 1,', details: '07.02 09:00 - 08.02 00:00, завершен' },
  { value: 'stage-2', label: 'Этап 2,', details: '08.02 09:00 - 18:00, завершен' },
  { value: 'stage-3', label: 'Этап 3,', details: '09.02 09:00 - продолжается' },
  { value: 'stage-4', label: 'Этап 4,', details: 'начнётся 10.02 09:00', upcoming: true },
  { value: 'stage-5', label: 'Этап 5,', details: 'начнётся 11.02 09:00', upcoming: true },
  { value: 'stage-6', label: 'Этап 6,', details: 'начнётся 12.02 09:00', upcoming: true },
  { value: 'stage-7', label: 'Этап 7,', details: 'начнётся 13.02 09:00', upcoming: true },
  { value: 'stage-8', label: 'Этап 8,', details: 'начнётся 14.02 09:00', upcoming: true },
];

function RenderStageSelect(args: RaceStageSelectProps) {
  const [, updateArgs] = useArgs<RaceStageSelectProps>();
  return (
    <AdaptivityProvider density="regular">
      <div style={{ width: '100%', maxWidth: 328 }}>
        <RaceStageSelect {...args} onChange={(value) => { args.onChange(value); updateArgs({ value }); }} />
      </div>
    </AdaptivityProvider>
  );
}

type StageStory = StoryObj<typeof RaceStageSelect>;
export const Select: StageStory = {
  name: 'Выбор этапа',
  args: { options: stages, value: 'stage-3', disabled: false, onChange: fn() },
  argTypes: { onChange: { control: false }, value: { control: 'select', options: stages.map((stage) => stage.value) } },
  globals: { appearance: 'light', platform: 'android', viewport: { value: 'mobile360', isRotated: false } },
  render: RenderStageSelect,
  parameters: { docs: { description: { story: 'Рабочая версия. Источник: Figma leyJ5DGOJdTNJlQHtgJTnJ, узел 339:7875. Эталон поля: 328 × 44 px. Закрытое поле: 13/16 Medium, 328 × 44 px. Семейство шрифта и точная сверка меню отложены; будущие этапы доступны, описание вторичным цветом VKUI.' } } },
};

export const OpenSelect: StageStory = {
  ...Select,
  name: 'Раскрытый список этапов',
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('combobox', { name: 'Этап гонки' }));
  },
};

export const FutureStage: StageStory = {
  ...Select,
  name: 'Будущий этап доступен для выбора',
  args: { ...Select.args, value: 'stage-4' },
};

export const DisabledSelect: StageStory = {
  ...Select,
  name: 'Выбор недоступен',
  args: { ...Select.args, disabled: true },
};
