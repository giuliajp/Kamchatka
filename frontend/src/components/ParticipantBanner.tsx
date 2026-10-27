import './race-kit.css';
import { Avatar, Banner } from '@vkontakte/vkui';
import { Icon24ChevronDown, Icon24ChevronUp, Icon28UserOutline } from '@vkontakte/icons';

export interface ParticipantBannerProps {
  name: string;
  region: string;
  discipline: string;
  photoUrl?: string;
  disabled?: boolean;
  expanded?: boolean;
  onOpen: () => void;
}

export function ParticipantBanner({ name, region, discipline, photoUrl, disabled, expanded, onOpen }: ParticipantBannerProps) {
  return (
    <Banner
      Component="button"
      className="race-native-action"
      disabled={disabled}
      onClick={onOpen}
      aria-expanded={expanded}
      title={name}
      subtitle={region}
      extraSubtitle={discipline}
      before={<Avatar size={72} src={photoUrl} alt={name} fallbackIcon={<Icon28UserOutline role="img" aria-hidden={false} aria-label="Фото отсутствует" />} />}
      after={expanded ? <Icon24ChevronUp /> : <Icon24ChevronDown />}
    />
  );
}
