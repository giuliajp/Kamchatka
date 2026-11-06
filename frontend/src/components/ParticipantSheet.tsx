import {raceStoryHeading} from '../api/storyImage';
import { useRef, useState } from 'react';
import { IconButton, ModalPage } from '@vkontakte/vkui';
import { Icon24ShareOutline, Icon20LikeOutline } from '@vkontakte/icons';
import { StoryShareButton } from './StoryShareButton';
import { ParticipantBanner } from './ParticipantBanner';
import { TimeBadge } from './TimeBadge';
import { RequestState } from './RequestState';
import { SupportAction, NotificationToggle } from './ParticipantActions';
import { useUser } from '../app/UserProvider';
import { useApi } from '../hooks/useApi';
import { dogsLabel, metric, raceDate, raceLongDate, raceTime, stale, statusLabel } from '../api/format';
import { query } from '../api/client';
import { raceLink, shareRace, updateRoute } from '../api/navigation';
import type { CheckpointPass, SupportState, Me } from '../types/content';
import type { ParticipantDetail, Position, Results, Stage, StageDetail } from '../types/api';
import './ParticipantSheet.css';

export interface ParticipantSheetProps {
  raceId?: number; participantId: number; entryId: number; position?: Position; threshold: number; onClose: () => void; stage?: Stage | StageDetail; showOfficial?: boolean; onNotificationRequest?: (participant:{number:number;photoUrl?:string})=>void;
}
export function ParticipantSheet({ raceId, participantId, entryId, position, threshold, onClose, stage, showOfficial = false, onNotificationRequest }: ParticipantSheetProps) {
  const user = useUser();
  const me = useApi<Me>(user.id ? '/me' : null, 0, false);
  const own = me.data?.participant_id === participantId && me.data.race_entries.some(item => item.race_participant_id === entryId);
  const person = useApi<ParticipantDetail>(`/participants/${participantId}`);
  const [expanded, setExpanded] = useState(false);
  const [feedback, setFeedback] = useState('');
  const entry = person.data?.races.find(entry => entry.race_participant_id === entryId && (raceId === undefined || entry.race.id === raceId));
  const official = useApi<Results>(entry && (stage?.status === 'finished' || showOfficial) ? query(`/races/${entry.race.id}/results`, { stage: stage?.number, discipline: entry.discipline.code }) : null);
  const result = official.data?.disciplines.flatMap(d => d.rows).find(row => row.race_participant_id === entryId);
  const cell = result?.stages.find(item => item.stage_number === stage?.number);
  const officialEntry = stage?.status === 'finished' || showOfficial ? result : entry;
  const support = useApi<SupportState>(entry ? `/race-participants/${entryId}/support` : null, 120000, false);
  const passes = useApi<CheckpointPass[]>(entry ? query(`/race-participants/${entryId}/checkpoint-passes`, { stage_id: stage?.id }) : null, 120000);
  const finish = stage ? passes.data?.find(pass => pass.stage_id === stage.id && pass.role === 'finish')?.arrived_at : undefined;
  // Как в макете: «Старт - КП-1 · 42 км», последний участок идущего этапа — «Проходит».
  const ordered = [...(passes.data ?? [])].sort((a,b) => a.stage_number - b.stage_number || a.order_index - b.order_index);
  const visits = ordered.map((pass, index) => {
    const previous = ordered[index - 1]?.stage_number === pass.stage_number ? ordered[index - 1].label || ordered[index - 1].name : 'Старт';
    return { id: pass.stage_checkpoint_id, index: index + 1, title: `${previous} - ${pass.label || pass.name}${pass.km_from_start === null ? '' : ` · ${metric(pass.km_from_start, 'км')}`}`,
      km: pass.km_from_start, arrivedAt: pass.arrived_at, departedAt: pass.departed_at, restMinutes: pass.required_rest_minutes, status: 'Пройден' };
  });
  const last = ordered.at(-1);
  const next = last && stage?.status === 'live' && last.stage_id === stage.id && last.role !== 'finish' && 'checkpoints' in stage
    ? stage.checkpoints.find(point => point.order_index > last.order_index) : undefined;
  if (last && next) visits.push({ id: -next.id, index: visits.length + 1, title: `${last.label || last.name} - ${next.label || next.name}${next.km_from_start === null ? '' : ` · ${metric(next.km_from_start, 'км')}`}`,
    km: next.km_from_start, arrivedAt: last.departed_at ?? last.arrived_at, departedAt: null, restMinutes: 0, status: 'Проходит' });
  visits.reverse();
  const rest = visits.filter(visit => visit.restMinutes > 0);
  const hasPosition = position?.position !== null && position !== undefined;
  const pointerStart = useRef(0);
  return <ModalPage disableOpenAnimation hideCloseButton className="participant-sheet" open onClose={onClose} aria-label="Карточка участника" height={expanded ? '92dvh' : 'calc(80dvh + 3px)'} settlingHeight={100}>
    <div className="map-participant" onPointerDown={event => { pointerStart.current = event.clientY; }}
      onPointerUp={event => { if (event.clientY - pointerStart.current > 100 && event.target === event.currentTarget) onClose(); }}>
      <button className="sheet-dismiss" aria-label="Свернуть" onClick={onClose}>×</button>
      <RequestState resource={person} /><RequestState resource={official} /><RequestState resource={support} />
      {person.data && <>
        {!entry && <p role="status">Участник не заявлен на выбранную гонку.</p>}
        {entry && <div className="map-participant__tags"><span>№{entry.start_number}</span><span>{entry.discipline.name}</span></div>}
        <div className="map-participant__bio"><ParticipantBanner name={person.data.full_name} region={entry?.region ?? 'Регион не указан'}
          discipline={entry ? `${entry.dog_breed || entry.discipline.name}${entry.dogs_count === null ? '' : ` | ${dogsLabel(entry.dogs_count)}`}` : ''} photoUrl={person.data.photo_url ?? undefined} expanded={expanded} onOpen={() => setExpanded(!expanded)} />
          {expanded && <div className="map-participant__biography"><h3>Биография участника</h3><p>{person.data.bio ?? 'Биография пока не опубликована.'}</p></div>}
        </div>
        {support.data && <div className="map-participant__fans"><Icon20LikeOutline /><span>{support.data.supporters_count} болельщиков</span>{entry?.race.status !== 'finished' && <strong>{support.data.change_24h > 0 ? "+" : ""}{support.data.change_24h} за сутки</strong>}</div>}
        <div className="map-participant__position">
          {position ? <span className="map-place" aria-label={`Позиция по GPS-трекеру: ${position.gps_rank ?? '—'}`}>{position.gps_rank ?? '—'} место</span>
            : officialEntry && <span className="map-place">{officialEntry.place === null ? statusLabel(officialEntry.status) : `${officialEntry.place} место`}</span>}
          {position && <TimeBadge state={!hasPosition ? 'unavailable' : stale(position, threshold) ? 'stale' : 'position'}>
            {!hasPosition ? 'Положения отсутствуют' : `${stale(position, threshold) ? 'Последняя подтверждённая точка' : 'Положение'} на ${raceTime(position.position!.position_at)}`}
          </TimeBadge>}
          {finish && <TimeBadge state="position">Финиш {raceDate(finish)}, {raceTime(finish)}</TimeBadge>}
        </div>
        {(position || officialEntry) && <div className="map-participant__stats">
          <div><strong>{position ? metric(position.gap_to_leader_km, 'км') : metric(officialEntry!.gap_to_leader_seconds, 'с')}</strong><span>от лидера</span></div>
          <div><strong>{position ? metric(position.avg_speed_kmh, 'км/ч') : cell?.time ?? officialEntry!.total_time ?? '—'}</strong><span>{position ? 'скорость' : cell ? 'время этапа' : 'итоговое время'}</span></div>
          <div><strong>{metric(position ? position.km_on_route : stage?.distance_km ?? null, 'км')}</strong><span>{position ? 'пройдено' : 'дистанция этапа'}</span></div>
        </div>}
        {entry && <section className="map-participant__route" aria-label="История контрольных пунктов"><h3>Прохождение контрольных пунктов (КП)</h3><RequestState resource={passes} />
          {visits.length ? visits.map(visit => <div key={visit.id} className="race-route-point"><span className="race-route-point__index">{visit.index}</span>
            <span className="race-route-point__content"><span className="race-route-point__title">{visit.title}</span><span className="race-route-point__time">{raceLongDate(visit.arrivedAt)} {raceTime(visit.arrivedAt)}{visit.departedAt ? ` - ${raceTime(visit.departedAt)}` : visit.status === 'Проходит' ? ' - --:--' : ''}</span></span>
            <span className="race-route-point__status" data-passing={visit.status === 'Проходит'}>{visit.status === 'Проходит' ? '•Проходит' : visit.status}</span></div>) : <p>История прохождения КП пока отсутствует.</p>}
        </section>}
        {rest.length > 0 && <section className="map-participant__route" aria-label="Обязательные остановки"><h3>Обязательные остановки</h3>
          {rest.map((visit, index) => <div key={visit.id} className="race-route-point"><span className="race-route-point__index">{rest.length - index}</span>
            <span className="race-route-point__content"><span className="race-route-point__title">Остановка{visit.km === null ? '' : ` · ${metric(visit.km, 'км')}`}</span>
              <span className="race-route-point__time">{raceLongDate(visit.arrivedAt)} {raceTime(visit.arrivedAt)} - {visit.departedAt ? raceTime(visit.departedAt) : '--:--'}</span></span>
            <span className="race-route-point__status" data-passing={!visit.departedAt}>{visit.departedAt ? 'Пройдена' : '•Идёт'}</span></div>)}
        </section>}
        {entry && <section className="participant-penalties"><h3>Штрафы</h3>{entry.penalties.length === 0 ? <p>Без штрафов</p> : entry.penalties.map((penalty, i) => <p key={i}>{penalty.seconds > 0 ? `+${penalty.time}` : 'Без штрафного времени'}{penalty.reason && ` · ${penalty.reason}`}{penalty.rule_reference && ` · п. ${penalty.rule_reference}`}</p>)}</section>}
        {entry && own && <button className="route-link" onClick={() => { updateRoute({section:'results',view:'track',raceId:entry.race.id,stageId:stage?.id,entryId,participantId}); }}>Трек на карте</button>}
        {entry && <div className="map-participant__actions">
          {<SupportAction onNotificationRequest={onNotificationRequest} raceId={entry.race.id} entryId={entryId} number={entry.start_number} photoUrl={person.data.photo_url ?? undefined} />}
          <IconButton label="Поделиться участником" onClick={async () => setFeedback(await shareRace(raceLink(entry.race.id, stage?.id, participantId, entryId), person.data!.full_name))}><Icon24ShareOutline /></IconButton>
          {<NotificationToggle raceId={entry.race.id} entryId={entryId} />}
        </div>}
        {entry && <StoryShareButton link={raceLink(entry.race.id, stage?.id, participantId, entryId)} card={{
          heading: raceStoryHeading(entry.race.name, entry.race.year), title: person.data.full_name,
          lines: ['Болею за участника', `№${entry.start_number} · ${entry.discipline.name}`], action: 'Открыть участника',
        }} />}
        {official.data && !result && <p>Результат участника для выбранного этапа пока не опубликован.</p>}
        {feedback && <p role="status" className="share-feedback">{feedback}</p>}
      </>}
    </div>
  </ModalPage>;
}
