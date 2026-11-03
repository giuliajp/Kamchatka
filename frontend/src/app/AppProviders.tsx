import type { ReactNode } from 'react';
import { AdaptivityProvider, AppRoot, ConfigProvider, type PlatformType } from '@vkontakte/vkui';
import '@vkontakte/vkui/dist/vkui.css';
import '../styles/layout.css';
import '../styles/fonts.css';
import { UserProvider } from './UserProvider';

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
        <AppRoot mode="embedded" disableParentTransformForPositionFixedElements={fullScreen} className="ui-root"><UserProvider>{children}</UserProvider></AppRoot>
      </AdaptivityProvider>
    </ConfigProvider>
  );
}
