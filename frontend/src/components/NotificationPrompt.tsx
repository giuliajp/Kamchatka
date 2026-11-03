import { useId } from 'react';
import { Avatar, Button, ButtonGroup, ModalCard } from '@vkontakte/vkui';
import { Icon28UserOutline } from '@vkontakte/icons';
export interface NotificationPromptProps {
  open: boolean;
  number: string;
  photoUrl?: string;
  loading?: boolean;
  onConfirm: () => void;
  onLater: () => void;
  onClose: () => void;
}
export function NotificationPrompt({ open, number, photoUrl, loading, onConfirm, onLater, onClose }: NotificationPromptProps) {
  const titleId = useId();
  return (
    <ModalCard open={open} onClose={onClose} titleId={titleId} aria-labelledby={titleId} dismissLabel="Закрыть" dismissButtonMode="inside"
      onKeyDown={event => {
        if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
      }}
      icon={<Avatar src={photoUrl} alt={`Участник №${number}`} fallbackIcon={<Icon28UserOutline />} />}
      title={`Получать уведомления об участнике №${number}?`}
      description="Получайте уведомления VK о событиях участника. Изменить разрешение можно в профиле."
      actions={<ButtonGroup mode="horizontal" gap="s" stretched>
        <Button size="l" mode="secondary" stretched onClick={onLater}>Позже</Button>
        <Button size="l" stretched loading={loading} disabled={loading} loadingLabel="Да, уведомлять" onClick={onConfirm}>Да, уведомлять</Button>
      </ButtonGroup>}
    />
  );
}
