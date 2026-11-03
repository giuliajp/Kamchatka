import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { query } from '../../api/client';
import { raceDate, raceTime } from '../../api/format';
import { RequestState } from '../../components/RequestState';
import type { ProgramEvent } from '../../types/content';
export const eventTypes = { stage_start: 'Старт этапа', stage_finish: 'Финиш этапа', festival: 'Фестиваль' };
export function ProgramScreen({ raceId }: { raceId: number }) {
  const program = useApi<ProgramEvent[]>(query('/program', { race_id: raceId }), 120000);
  const [day, setDay] = useState(''); const [type, setType] = useState('');
  const days = [...new Set(program.data?.map(event => raceDate(event.start_at)))];
  const events = program.data?.filter(event => (!day || raceDate(event.start_at) === day) && (!type || event.event_type === type));
  return <section className="race-content content-page"><h2>Программа</h2><p>Время по Камчатке · UTC+12</p>
    <div className="content-filters"><label>День<select value={day} onChange={e => setDay(e.target.value)}><option value="">Все дни</option>{days.map(date => <option key={date}>{date}</option>)}</select></label>
      <label>Тип события<select value={type} onChange={e => setType(e.target.value)}><option value="">Все события</option>{Object.entries(eventTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    <RequestState resource={program} />
    {events?.length === 0 && <p>Опубликованных событий нет.</p>}
    {events?.map(event => <article className="content-card" key={event.id}><small>{raceDate(event.start_at)} · {eventTypes[event.event_type]}</small><h3>{event.title}</h3>
      <p><time dateTime={event.start_at}>{raceTime(event.start_at)}</time>{event.end_at && ` — ${raceDate(event.end_at)} ${raceTime(event.end_at)}`}</p>
      {event.description && <p>{event.description}</p>}{event.location && <p>{event.location.name}{event.location.address && ` · ${event.location.address}`}</p>}</article>)}
  </section>;
}
