import { useMemo, useState } from 'react';
import { Button } from '@vkontakte/vkui';
import { useApi } from '../../hooks/useApi';
import { StoryShareButton } from '../../components/StoryShareButton';
import { RequestState } from '../../components/RequestState';
import { query } from '../../api/client';
import { metric } from '../../api/format';
import { shareRace, closeRoute, viewLink } from '../../api/navigation';
import { prepareMapData, validCoordinates } from '../Map/mapData';
import { MapCanvas } from '../Map/MapCanvas';
import type { Participant, RaceDetail, StageDetail, Track } from '../../types/api';

export function TrackScreen({ race, stageId, entryId }: { race: RaceDetail; stageId?: number; entryId: number }) {
  const [feedback, setFeedback] = useState('');
  const participants = useApi<Participant[]>(`/races/${race.id}/participants`);
  const entry = participants.data?.find(item => item.race_participant_id === entryId);
  const stage = useApi<StageDetail>(stageId && race.stages.some(stage => stage.id === stageId) ? `/stages/${stageId}` : null);
  const track = useApi<Track>(entry && (!stageId || stage.data) ? query(`/race-participants/${entryId}/track`, { stage: stage.data?.number }) : null, 0, false);
  const map = useMemo(() => {
    if (!stage.data) return;
    const data = prepareMapData(stage.data, []);
    for (const point of track.data?.points ?? []) if (validCoordinates(point.latitude, point.longitude)) data.bounds.extend([point.latitude, point.longitude]);
    return data;
  }, [stage.data, track.data]);
  return <section className="race-content content-page"><button className="text-action" onClick={() => closeRoute({ view: 'summaries' })}>← Назад к результатам</button><h2>Трек участника</h2><RequestState resource={participants} /><RequestState resource={stage} /><RequestState resource={track} />
    {participants.data && !entry && <p>Участник не найден в этом сезоне.</p>}
    {entry && <><h3>{entry.full_name} · №{entry.start_number}</h3><div className="venue-card"><p>Дистанция этапа: {metric(stage.data?.distance_km ?? null, 'км')}</p><p>Итоговое время за гонку: {entry.total_time ?? '—'}</p><p>Место в дисциплине: {entry.place ?? '—'}</p></div>
      {map?.bounds.isValid() ? <div className="content-map track-map"><MapCanvas data={map} track={track.data} viewKey={`track:${entryId}:${stageId}:${track.data?.points.length}`} threshold={45} refreshing={track.loading} onRefresh={track.refresh} onSelect={() => undefined} onCluster={() => undefined} /></div> : <p>Маршрут пока не опубликован.</p>}
      {track.data?.points.length === 0 && <p>Подтверждённых точек трека пока нет.</p>}
      <p className="supporting-text">Трек построен по подтверждённым GPS-точкам. Итоговое время и место взяты из судейских протоколов.</p>
      <Button size="l" stretched onClick={async () => setFeedback(await shareRace(viewLink({ raceId: race.id, stageId, participantId: entry.participant_id, entryId }), `Результаты: ${entry.full_name}`))}>Опубликовать результаты</Button>{feedback && <p role="status">{feedback}</p>}
      <StoryShareButton link={viewLink({raceId: race.id, stageId, participantId: entry.participant_id, entryId})} card={{
        heading: `${race.name} · ${race.year}`, title: `${entry.full_name} · №${entry.start_number}`,
        lines: [entry.discipline.name, `Итоговое время за гонку: ${entry.total_time ?? '—'}`, `Место в дисциплине: ${entry.place ?? '—'}`], action: 'Смотреть результаты',
      }} />
    </>}
  </section>;
}
