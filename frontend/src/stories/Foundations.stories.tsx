import type { Meta, StoryObj } from '@storybook/react-vite';
import { Caption, Footnote, Headline, Text, Title } from '@vkontakte/vkui';

const meta = {
  title: 'Компоненты из VKUI/Справочник/Токены VKUI',
  parameters: { docs: { description: { component: 'Стандартные токены VKUI. Переключайте тему и платформу в панели. Брендовая палитра и Gotham Pro пока не подключены.' } } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Colors: Story = {
  name: 'Цветовые роли',
  render: () => <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
    {[
      ['Фон', 'color_background_content'], ['Поверхность', 'color_background_secondary'],
      ['Основной текст', 'color_text_primary'], ['Вторичный текст', 'color_text_secondary'],
      ['Акцент', 'color_background_accent'], ['Граница', 'color_separator_primary'],
      ['Ошибка', 'color_text_negative'], ['Успех', 'color_text_positive'], ['Предупреждение', 'color_accent_orange'],
    ].map(([label, token]) => <div key={token}>
      <div aria-hidden style={{ height: 64, borderRadius: 'var(--vkui--size_border_radius--regular)', background: `var(--vkui--${token})`, border: '1px solid var(--vkui--color_separator_primary)', marginBottom: 12 }} />
      <Headline>{label}</Headline><Footnote style={{ overflowWrap: 'anywhere' }}>{token}</Footnote>
    </div>)}
  </div>,
};

export const Typography: Story = {
  name: 'Типографика',
  render: () => <div style={{ display: 'grid', gap: 20, maxWidth: '65ch' }}>
    <Title level="1" Component="h1">Авача. Гонка на Камчатке</Title>
    <Title level="2" Component="h2">Участники и дисциплины</Title>
    <Title level="3" Component="h3">Александра Константинопольская</Title>
    <Headline>Заголовок блока</Headline>
    <Text>Последняя подтверждённая точка участника показана со временем обновления. Кириллица: Ёж, Й, Щ. Latin: Avacha.</Text>
    <Footnote>Второстепенный текст и подписи</Footnote>
    <Caption>Вспомогательная подпись</Caption>
    <Title level="2">№ 12 · 14:20 · 18,4 км/ч</Title>
  </div>,
};

export const Spacing: Story = {
  name: 'Отступы и скругления',
  render: () => <div style={{ display: 'grid', gap: 24 }}>
    {['xs', 's', 'm', 'l', 'xl'].map((size) => <div key={size}>
      <Footnote>spacing_size_{size}</Footnote>
      <div aria-hidden style={{ width: `var(--vkui--spacing_size_${size})`, height: 32, background: 'var(--vkui--color_background_accent)' }} />
    </div>)}
    <div style={{ padding: 24, border: '1px solid var(--vkui--color_separator_primary)', borderRadius: 'var(--vkui--size_border_radius--regular)' }}>
      <Text>Стандартное скругление VKUI</Text>
    </div>
  </div>,
};
