import { Icon24MoreHorizontal, Icon24Dismiss } from '@vkontakte/icons';
import { PanelHeader, PanelHeaderBack, PanelHeaderButton } from '@vkontakte/vkui';

export interface RacePanelHeaderProps {
  title: string;
  onBack?: () => void;
  onMenu?: () => void;
  onClose?: () => void;
}

export function RacePanelHeader({ title, onBack, onMenu, onClose }: RacePanelHeaderProps) {
  return (
    <PanelHeader
      fixed={false}
      delimiter="none"
      typographyProps={{ Component: 'h1', style: { fontSize: '.875rem', lineHeight: '1.125rem' } }}
      before={onBack && <PanelHeaderBack aria-label="Назад" onClick={onBack} />}
      after={(
        <>
          {onMenu && <PanelHeaderButton aria-label="Меню" onClick={onMenu}><Icon24MoreHorizontal /></PanelHeaderButton>}
          {onClose && <PanelHeaderButton aria-label="Закрыть" onClick={onClose}><Icon24Dismiss /></PanelHeaderButton>}
        </>
      )}
    >
      {title}
    </PanelHeader>
  );
}
