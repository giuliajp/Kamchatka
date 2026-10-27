import { useId, useState } from 'react';
import { Button, Div, Flex, ModalPage, ModalPageHeader } from '@vkontakte/vkui';
import { Icon24Add, Icon24ChevronUp, Icon24ShareOutline } from '@vkontakte/icons';
import { ParticipantBanner } from './ParticipantBanner';
import { SupportButton } from './SupportButton';
import { ParticipantGap } from './ParticipantGap';
import { ParticipantCard, type ParticipantCardProps } from './ParticipantCard';
import { ParticipantPosition, type ParticipantPositionProps } from './ParticipantPosition';
import { TimeBadge, type TimeBadgeProps } from './TimeBadge';
import { RoutePoint, type RoutePointProps } from './RoutePoint';
export interface ParticipantSheetProps {
  open: boolean;
  participant: ParticipantCardProps;
  position: ParticipantPositionProps;
  freshness: TimeBadgeProps[];
  route: (RoutePointProps & { id: string })[];
  photoAction?: { label: string; onOpen: () => void };
  details?: { disciplineLabel: string; biography: string[]; supporters: number; speed: string; distance: string; expanded?: boolean };
  onShare: () => void;
  onClose: () => void;
}
export function ParticipantSheet({ open, participant, position, freshness, route, photoAction, details, onShare, onClose }: ParticipantSheetProps) {
  const titleId = useId();
  const [expanded, setExpanded] = useState(details?.expanded ?? false);
  return <ModalPage open={open} onClose={onClose} aria-labelledby={titleId} dynamicContentHeight={!details} height={details ? "84dvh" : undefined} settlingHeight={100}
    className={details ? "map-participant-sheet" : undefined}
    header={<ModalPageHeader><span id={titleId}>Участник №{participant.number}</span></ModalPageHeader>}>
    {details ? <div className="map-participant">
      <div className="map-participant__tags"><span>№{participant.number}</span><span>{details.disciplineLabel}</span></div>
      <div className="map-participant__bio">
        <ParticipantBanner expanded={expanded} name={participant.name} region={participant.region} discipline={participant.discipline}
          photoUrl={participant.photoUrl} onOpen={() => setExpanded(!expanded)} />
        {expanded && <div className="map-participant__biography"><h3>Биография участника</h3>{details.biography.map(text => <p key={text}>{text}</p>)}</div>}
      </div>
      <p className="map-participant__fans"><img src="/figma/map-screen/10c0f.svg" width={20} height={20} alt="" />{details.supporters} болельщиков <span>+87 за сутки</span></p>
      <div className="map-participant__position"><span className="map-place">{position.place} место</span>{freshness.map((badge, index) => <TimeBadge key={index} {...badge} />)}</div>
      <div className="map-participant__stats"><ParticipantGap gap={position.gap} /><div><strong>{details.speed}</strong><span>средняя скорость</span></div><div><strong>{details.distance}</strong><span>пройдено</span></div></div>
      <h3>Прохождение контрольных пунктов (КП)</h3>
      <div className="map-participant__route">{route.map(({ id, ...point }) => <RoutePoint key={id} {...point} />)}</div>
      <div className="map-participant__actions"><SupportButton selected={participant.supported} onToggle={participant.onSupportToggle} />
        <Button size="l" mode="outline" aria-label="Поделиться" onClick={onShare}><Icon24ShareOutline /></Button></div>
      <Button stretched mode="tertiary" onClick={onClose}>Свернуть</Button>
    </div> : <Div><Flex direction="column" gap="l">
      <ParticipantCard {...participant} />
      <ParticipantPosition {...position} />
      <Flex direction="column" align="start" gap="s">{freshness.map((badge, index) => <TimeBadge key={index} {...badge} />)}</Flex>
      <div>{route.map(({ id, ...point }) => <RoutePoint key={id} {...point} />)}</div>
      <Flex wrap="wrap" gap="s">
        <Button mode="outline" before={<Icon24ShareOutline />} onClick={onShare}>Поделиться</Button>
        {photoAction && <Button mode="tertiary" before={<Icon24Add />} onClick={photoAction.onOpen}>{photoAction.label}</Button>}
        <Button mode="tertiary" after={<Icon24ChevronUp />} onClick={onClose}>Свернуть</Button>
      </Flex>
    </Flex></Div>}
  </ModalPage>;
}
