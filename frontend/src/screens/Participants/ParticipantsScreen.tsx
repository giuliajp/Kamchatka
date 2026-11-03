import { useState } from 'react';
import { Search, NativeSelect } from '@vkontakte/vkui';
import { useApi } from '../../hooks/useApi';
import { query } from '../../api/client';
import type { Participant } from '../../types/api';
import { ParticipantCard } from '../../components/ParticipantCard';
import { RequestState } from '../../components/RequestState';
import { DataState } from '../../components/DataState';
import { useUser } from '../../app/UserProvider';
import { SupportAction } from '../../components/ParticipantActions';
import { statusLabel } from '../../api/format';

export function ParticipantsScreen({ raceId, discipline, onSelect, mine = false }: {
  raceId: number; discipline: string; mine?: boolean; onSelect: (participantId: number, entryId: number) => void;
}) {
  const user = useUser();
  const supported = (id: number) => user.supports.data?.some(item => item.race_id === raceId && item.race_participant_id === id) ?? false;
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('start_number');
  const participants = useApi<Participant[]>(query(`/races/${raceId}/participants`, { discipline, q: search.trim(), sort }));
  const items = participants.data?.filter(p => !mine || supported(p.race_participant_id));
  return <section className="race-content" aria-label="Участники гонки"><h2>Участники</h2>
    <Search slotProps={{ input: { 'aria-label': 'Поиск участника' } }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Имя или стартовый номер" />
    <NativeSelect slotProps={{ select: { 'aria-label': 'Сортировка участников' } }} value={sort} onChange={e => setSort(e.target.value)}>
      <option value="start_number">По стартовому номеру</option><option value="name">По имени</option><option value="place">По месту в дисциплине</option>
    <option value="supporters">По количеству болельщиков</option>
    </NativeSelect>
    <RequestState resource={participants} />
    {items?.length === 0 && (mine && participants.data!.length > 0 ? <p role="status">В вашем списке нет участников по выбранным условиям. Нажмите «Болею за» в общем списке.</p> : <DataState status="empty" />)}
    <div className="participants-list">{items?.map(participant => <div key={participant.race_participant_id}>
      <ParticipantCard name={participant.full_name} number={participant.start_number} region={participant.region ?? 'Регион не указан'}
        discipline={participant.discipline.name} photoUrl={participant.photo_url ?? undefined} showSupport={false}
        supported={supported(participant.race_participant_id)}
        supportAction={<SupportAction raceId={raceId} entryId={participant.race_participant_id} number={participant.start_number} photoUrl={participant.photo_url ?? undefined} />}
        onOpen={() => onSelect(participant.participant_id, participant.race_participant_id)} />
      <p className="participant-summary">{statusLabel(participant.status)} · Место в дисциплине: {participant.place ?? '—'} · Время: {participant.total_time ?? '—'}</p>
      <p className="participant-summary">{participant.supporters_count} болельщиков · {participant.supporters_change_24h > 0 ? "+" : ""}{participant.supporters_change_24h} за сутки</p>
    </div>)}</div>
  </section>;
}
