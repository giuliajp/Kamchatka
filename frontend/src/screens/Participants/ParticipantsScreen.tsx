import { useState } from 'react';
import { Search, NativeSelect } from '@vkontakte/vkui';
import { useApi } from '../../hooks/useApi';
import { query } from '../../api/client';
import type { Participant } from '../../types/api';
import { ParticipantCard } from '../../components/ParticipantCard';
import { RequestState } from '../../components/RequestState';
import { DataState } from '../../components/DataState';
import { mockFeaturesEnabled, participationKey, supporters, useExtras } from '../../mocks/extras';
import { SupportAction } from '../../components/ParticipantActions';
import { statusLabel } from '../../api/format';

export function ParticipantsScreen({ raceId, discipline, onSelect, mine = false }: {
  raceId: number; discipline: string; mine?: boolean; onSelect: (participantId: number, entryId: number) => void;
}) {
  const { value } = useExtras();
  const enabled = mockFeaturesEnabled();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('start_number');
  const participants = useApi<Participant[]>(query(`/races/${raceId}/participants`, { discipline, q: search.trim(), sort: sort === 'supporters' ? 'start_number' : sort }));
  const items = participants.data?.filter(p => !mine || value.supported.includes(participationKey(raceId, p.race_participant_id)));
  if (sort === 'supporters') items?.sort((a, b) => supporters(b.race_participant_id, value.supported.includes(participationKey(raceId, b.race_participant_id))).total - supporters(a.race_participant_id, value.supported.includes(participationKey(raceId, a.race_participant_id))).total);
  return <section className="race-content" aria-label="Участники гонки"><h2>Участники</h2>
    <Search slotProps={{ input: { 'aria-label': 'Поиск участника' } }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Имя или стартовый номер" />
    <NativeSelect slotProps={{ select: { 'aria-label': 'Сортировка участников' } }} value={sort} onChange={e => setSort(e.target.value)}>
      <option value="start_number">По стартовому номеру</option><option value="name">По имени</option><option value="place">По месту в дисциплине</option>
    {enabled && <option value="supporters">По количеству болельщиков</option>}
    </NativeSelect>
    <RequestState resource={participants} />
    {items?.length === 0 && (mine && participants.data!.length > 0 ? <p role="status">В вашем списке нет участников по выбранным условиям. Нажмите «Болею за» в общем списке.</p> : <DataState status="empty" />)}
    <div className="participants-list">{items?.map(participant => <div key={participant.race_participant_id}>
      <ParticipantCard name={participant.full_name} number={participant.start_number} region={participant.region ?? 'Регион не указан'}
        discipline={participant.discipline.name} photoUrl={participant.photo_url ?? undefined} showSupport={false}
        supported={enabled && value.supported.includes(participationKey(raceId, participant.race_participant_id))}
        supportAction={enabled && <SupportAction raceId={raceId} entryId={participant.race_participant_id} number={participant.start_number} photoUrl={participant.photo_url ?? undefined} />}
        onOpen={() => onSelect(participant.participant_id, participant.race_participant_id)} />
      <p className="participant-summary">{statusLabel(participant.status)} · Место в дисциплине: {participant.place ?? '—'} · Время: {participant.total_time ?? '—'}</p>
      {enabled && <p className="participant-summary mock-note">{supporters(participant.race_participant_id, value.supported.includes(participationKey(raceId, participant.race_participant_id))).total} болельщиков · демонстрационный счётчик</p>}
    </div>)}</div>
  </section>;
}
