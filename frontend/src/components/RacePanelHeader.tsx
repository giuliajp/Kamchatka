import { Icon24MoreHorizontal, Icon24Dismiss } from '@vkontakte/icons';
import { PanelHeader, PanelHeaderBack, PanelHeaderButton } from '@vkontakte/vkui';

export interface RacePanelHeaderProps {
  title: string;
  onBack: () => void;
  onMenu: () => void;
  onClose: () => void;
}

export function RacePanelHeader({ title, onBack, onMenu, onClose }: RacePanelHeaderProps) {
  return (
    <PanelHeader
      fixed={false}
      delimiter="none"
      typographyProps={{ Component: 'h1', style: { fontSize: '1rem', lineHeight: '1.25rem' } }}
      before={<PanelHeaderBack aria-label="Назад" onClick={onBack} />}
      after={(
        <>
          <PanelHeaderButton aria-label="Меню" onClick={onMenu}><Icon24MoreHorizontal /></PanelHeaderButton>
          <PanelHeaderButton aria-label="Закрыть" onClick={onClose}><Icon24Dismiss /></PanelHeaderButton>
        </>
      )}
    >
      {title}
    </PanelHeader>
  );
}
