import { useId } from 'react';
import { Avatar, Card, Footnote, Text, Title } from '@vkontakte/vkui';
import { Icon28UserOutline } from '@vkontakte/icons';
import { SupportButton } from './SupportButton';
import './components.css';
import type { ReactNode } from 'react';

export interface ParticipantCardProps {
  name: string;
  number: number;
  region: string;
  discipline: string;
  photoUrl?: string;
  variant?: 'card' | 'row';
  supported: boolean;
  supportLoading?: boolean;
  supportDisabled?: boolean;
  onSupportToggle?: () => void;
  showSupport?: boolean;
  onOpen?: () => void;
  supportAction?: ReactNode;
}

export function ParticipantCard({
  name, number, region, discipline, photoUrl, variant = 'card',
  supported, supportLoading, supportDisabled, onSupportToggle, showSupport = true, onOpen, supportAction,
}: ParticipantCardProps) {
  const headingId = useId();
  return (
    <Card Component="article" mode="outline" aria-labelledby={headingId} className="participant" data-variant={variant}>
      <div className="participant__identity">
        <Avatar size={64} src={photoUrl} alt={name}
          fallbackIcon={<Icon28UserOutline role="img" aria-hidden={false} aria-label="Фото отсутствует" />} />
        <div className="participant__copy">
          <Footnote className="supporting-text">№ {number}</Footnote>
          <Title level="3" Component="h3" id={headingId}>{name}</Title>
          <Text>{region}</Text>
          <Footnote className="supporting-text">{discipline}</Footnote>
        </div>
      </div>
      {showSupport && onSupportToggle && <SupportButton selected={supported} loading={supportLoading} disabled={supportDisabled} onToggle={onSupportToggle} />}
      {supportAction}
      {onOpen && <button className="participant-open text-action" onClick={onOpen}>Открыть карточку {name}</button>}
    </Card>
  );
}
