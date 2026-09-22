/**
 * Токены темы, собранные из брендбука Камчатки (docs/brand/colors.md, typography.md).
 *
 * ВАЖНО: это временная рабочая палитра общего бренда «Камчатка».
 * Как только появится брендбук именно фестиваля «Берингия» / гонки «Авача» — обновить здесь.
 *
 * HEX переведены из CMYK брендбука приблизительно, для UI этого достаточно.
 */

export const colors = {
  // Основные
  navy: '#003083', // Pantone 541 C — основной фирменный цвет
  white: '#FFFFFF',

  // Дополнительные (акценты, иконки, разделы)
  yellow: '#FFBF1A', // Pantone 116 C
  lightBlue: '#4DF2FF', // Pantone 2925 C
  brown: '#603425', // Pantone 7602 C
  green: '#33FF00', // Pantone 361 C
  red: '#FF2640', // Pantone Warm Red C
  lilac: '#8080FF', // Pantone 322 U
  blue: '#2680FF', // Pantone 660 C
  magenta: '#FF00C7', // Pantone 213 C
} as const;

// Светлая и тёмная темы — обязательное требование брифа.
export const lightTheme = {
  background: colors.white,
  surface: '#F4F6FA',
  textPrimary: colors.navy,
  textSecondary: '#5C6B85',
  accent: colors.blue,
  danger: colors.red,
};

export const darkTheme = {
  background: '#0B1730',
  surface: '#142348',
  textPrimary: colors.white,
  textSecondary: '#9AACD1',
  accent: colors.lightBlue,
  danger: colors.red,
};

export const fontFamily = {
  base: "'Gotham Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

export const fontWeight = {
  light: 300,
  regular: 400,
  medium: 500,
  bold: 700,
  black: 900,
};

export type ThemeMode = 'light' | 'dark';

export const themes: Record<ThemeMode, typeof lightTheme> = {
  light: lightTheme,
  dark: darkTheme,
};
