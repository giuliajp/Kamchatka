import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import { TextField, type TextFieldProps } from '../components/TextField';

const meta = {
  title: 'Компоненты из VKUI/Дополнительные компоненты/TextField', component: TextField,
  args: { label: 'Имя участника', value: '', description: 'Как в официальном протоколе', onChange: fn() },
  render: function Render(args) {
    const [, updateArgs] = useArgs<TextFieldProps>();
    return <TextField {...args} onChange={(value) => { args.onChange(value); updateArgs({ value }); }} />;
  },
  parameters: { docs: { description: { component: 'FormItem и Input с общей подписью, описанием и ошибкой. Ошибка имеет приоритет над подсказкой. Значение управляется через value/onChange.' } } },
} satisfies Meta<typeof TextField>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Empty: Story = { name: 'Пустое' };
export const Filled: Story = { name: 'Заполнено', args: { value: 'Александра Константинопольская' } };
export const Error: Story = { name: 'Ошибка', args: { error: 'Введите имя участника' } };
export const Disabled: Story = { name: 'Недоступно', args: { disabled: true, value: 'Александра' } };
export const Focus: Story = { name: 'Фокус', play: async ({ canvas }) => { canvas.getByRole('textbox').focus(); } };
