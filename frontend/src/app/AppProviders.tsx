import type { ReactNode } from 'react';
import { AdaptivityProvider, AppRoot, ConfigProvider, type PlatformType } from '@vkontakte/vkui';
import '@vkontakte/vkui/dist/vkui.css';
import '../styles/layout.css';
import '../styles/fonts.css';
import { ExtrasProvider } from '../mocks/extras';

export interface AppProvidersProps {
  children: ReactNode;
  fullScreen?: boolean;
  appearance?: 'light' | 'dark';
  platform?: PlatformType;
}

export function AppProviders({ children, appearance = 'light', platform = 'android', fullScreen = false }: AppProvidersProps) {
  return (
    <ConfigProvider colorScheme={appearance} platform={platform} locale="ru">
      <AdaptivityProvider>
        <AppRoot mode="embedded" disableParentTransformForPositionFixedElements={fullScreen} className="ui-root"><ExtrasProvider>{children}</ExtrasProvider></AppRoot>
      </AdaptivityProvider>
    </ConfigProvider>
  );
}
