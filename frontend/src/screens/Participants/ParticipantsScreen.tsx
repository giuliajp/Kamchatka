import { useState } from 'react';
import { Avatar, Search, Popover, Radio, RadioGroup } from '@vkontakte/vkui';
import { Icon16Dropdown, Icon16Chevron, Icon20LikeOutline, Icon20SortOutline, Icon28UserOutline } from '@vkontakte/icons';
import { useApi } from '../../hooks/useApi';
import { query } from '../../api/client';
import type { Participant } from '../../types/api';
import { RequestState } from '../../components/RequestState';
import { DataState } from '../../components/DataState';
import { useUser } from '../../app/UserProvider';

const sorts = { start_number:'По стартовому номеру',name:'По имени',place:'По месту в дисциплине',supporters:'По количеству болельщиков' };
export function ParticipantsScreen({ raceId, discipline, onSelect, mine = false, search }: {
  raceId: number; discipline: string; mine?: boolean; search?:string; onSelect: (participantId: number, entryId: number) => void;
}) {
  const user = useUser();
  const supported = (id: number) => user.supports.data?.some(item => item.race_id === raceId && item.race_participant_id === id) ?? false;
  const [localSearch, setSearch] = useState('');
  const [sort, setSort] = useState('start_number');
  const [sortOpen,setSortOpen] = useState(false);
  const participants = useApi<Participant[]>(query(`/races/${raceId}/participants`, { discipline, q: (search ?? localSearch).trim(), sort }));
  const items = participants.data?.filter(p => !mine || supported(p.race_participant_id));
  return <section className="race-content participants-page" aria-label="Участники гонки">
    {search === undefined && <Search slotProps={{input:{'aria-label':'Поиск участника'}}} value={localSearch} onChange={e=>setSearch(e.target.value)} placeholder="Поиск по имени"/>}
    <Popover shown={sortOpen} onShownChange={setSortOpen} trigger="click" placement="bottom-start" autoFocus restoreFocus aria-label="Сортировка участников" content={<RadioGroup aria-label="Сортировка участников">{Object.entries(sorts).map(([value,label])=><Radio key={value} name="participant-sort" value={value} checked={sort===value} readOnly onClick={()=>{setSort(value);setSortOpen(false);}}>{label}</Radio>)}</RadioGroup>}>
      <button className="participants-sort" aria-expanded={sortOpen} aria-haspopup="dialog"><Icon20SortOutline aria-hidden/>Сортировать<Icon16Dropdown aria-hidden/></button>
    </Popover>
    <RequestState resource={participants} />
    {items?.length === 0 && (mine && participants.data!.length > 0 ? <p role="status">В вашем списке нет участников по выбранным условиям. Нажмите «Болею за» в карточке участника.</p> : <DataState status="empty" />)}
    <div className="participants-list">{items?.map((participant,index)=><button className="participant-row" key={participant.race_participant_id} onClick={()=>onSelect(participant.participant_id,participant.race_participant_id)} aria-label={`Открыть карточку ${participant.full_name}`}>
      <span className="participant-row__rank">{index+1}.</span>
      <Avatar size={44} src={participant.photo_url ?? undefined} alt="" fallbackIcon={<Icon28UserOutline/>}/>
      <span className="participant-row__body"><strong>{participant.full_name}</strong><span>{participant.discipline.name}</span><small><Icon20LikeOutline width={16} height={16} aria-hidden/>{participant.supporters_count} болельщиков</small></span>
      <span className="participant-row__end"><span>№{participant.start_number}</span><Icon16Chevron aria-hidden/></span>
    </button>)}</div>
  </section>;
}
