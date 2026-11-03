import { useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { query } from '../../api/client';
import { raceDate, raceTime } from '../../api/format';
import { closeRoute, updateRoute } from '../../api/navigation';
import { useRoute } from '../../hooks/useRoute';
import { RequestState } from '../../components/RequestState';
import { ContentSheet, PhotoCarousel } from '../../components/ContentSheet';
import { ReminderButton } from './ReminderButton';
import { ArrivalEstimate } from './ArrivalEstimate';
import { LocationsScreen } from './LocationsScreen';
import type { Location, ProgramEvent } from '../../types/content';
import type { RaceDetail, StageDetail } from '../../types/api';

export const eventTypes = { stage_start: 'Старт этапа', stage_finish: 'Финиш этапа', festival: 'Культурная программа', master_class: 'Мастер-класс', meeting: 'Встреча' };
export const dayKey = (iso: string) => new Date(Date.parse(iso) + 12 * 3600000).toISOString().slice(0, 10);
export function programDays(events: ProgramEvent[], race?: RaceDetail) {
  const dates = events.map(event => dayKey(event.start_at)).sort();
  const first = [race?.start_date, dates[0]].filter((date): date is string => Boolean(date)).sort()[0] || dayKey(new Date().toISOString());
  const last = [race?.end_date, dates.at(-1), first].filter((date): date is string => Boolean(date)).sort().at(-1)!;
  // ponytail: show at most a year in the strip; the date input reaches any later day.
  const count = Math.max(1, Math.min(366, Math.round((Date.parse(last) - Date.parse(first)) / 86400000) + 1));
  return Array.from({ length: count }, (_, i) => new Date(Date.parse(first) + i * 86400000).toISOString().slice(0, 10));
}
export const locationRoute = (place: Location) => `https://yandex.ru/maps/?rtext=~${place.latitude},${place.longitude}&rtt=auto`;
function EventTime({ event }: { event: ProgramEvent }) {
  return <time dateTime={event.start_at}>{raceTime(event.start_at)}{event.end_at && ` – ${dayKey(event.end_at) !== dayKey(event.start_at) ? raceDate(event.end_at) + ' ' : ''}${raceTime(event.end_at)}`}</time>;
}
export function ProgramScreen({ raceId, race, embedded = false }: { raceId: number; race?: RaceDetail; embedded?: boolean }) {
  const route = useRoute();
  const program = useApi<ProgramEvent[]>(query('/program', { race_id: raceId }), 120000);
  const locations = useApi<Location[]>(query('/locations', { race_id: raceId }), 120000);
  const days = programDays(program.data ?? [], race);
  const today = dayKey(new Date().toISOString());
  const day = route.day || (days.includes(today) ? today : days[0]);
  const watch = route.view === 'watch';
  const dayEvents = program.data?.filter(event => dayKey(event.start_at) === day);
  const events = dayEvents?.filter(event => !route.category || event.event_type === route.category);
  const event = program.data?.find(item => item.id === route.eventId);
  const place = locations.data?.find(item => item.id === route.locationId);
  const stageId = events?.find(item => item.stage_id !== null)?.stage_id;
  const stage = useApi<StageDetail>(watch && stageId ? `/stages/${stageId}` : null);
  const placeEvents = program.data?.filter(item => item.location?.id === place?.id && (route.allEvents || dayKey(item.start_at) === day)) ?? [];
  const close = () => closeRoute({ eventId: undefined, locationId: undefined, expanded: undefined, reminders: undefined, allEvents: undefined });
  const openPlace = useCallback((id: number) => updateRoute({ locationId: id, eventId: undefined, expanded: undefined, reminders: undefined, allEvents: undefined }), []);
  const openEvent = (id: number) => updateRoute({ eventId: id, locationId: undefined, expanded: undefined, reminders: undefined, allEvents: undefined });
  return <section className="race-content content-page program-page">{!embedded && <h2>Программа</h2>}<p className="supporting-text">Время по Камчатке · UTC+12</p>
    <div className="program-days" role="group" aria-label="Дни программы">{days.map(date => <button aria-pressed={day === date} key={date} onClick={() => updateRoute({ day: date, eventId: undefined, locationId: undefined })}><strong>{Number(date.slice(-2))}</strong><small>{new Intl.DateTimeFormat('ru', { weekday: 'short', timeZone: 'UTC' }).format(new Date(date))}</small></button>)}</div>
    <details className="program-date"><summary>Выбрать день</summary><label>Дата<input aria-label="День программы" type="date" value={day} onChange={e => updateRoute({ day: e.target.value, eventId: undefined, locationId: undefined })} /></label></details>
    <div className="content-tabs" role="group" aria-label="Вид программы"><button aria-pressed={!watch} onClick={() => updateRoute({ view: 'schedule', eventId: undefined, locationId: undefined })}>Расписание</button><button aria-pressed={watch} onClick={() => updateRoute({ view: 'watch', eventId: undefined, locationId: undefined })}>Где смотреть</button></div>
    {!watch && <label className="program-category">Категория<select value={route.category || ''} onChange={e => updateRoute({ category: e.target.value, eventId: undefined, locationId: undefined })}><option value="">Все события</option>{Object.entries(eventTypes).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
    <h3>{raceDate(day)} · {new Intl.DateTimeFormat('ru', { weekday: 'long', timeZone: 'UTC' }).format(new Date(day))}</h3>
    <RequestState resource={program} /><RequestState resource={locations} />
    {!watch && <>{dayEvents?.length === 0 && <div className="program-empty"><img src="/figma/map-screen/5b9db.svg" width={115.006} height={50.0002} alt="Берингия. Авача"/><h3>Сегодня участники отдыхают</h3><p>Мероприятий нет. Выберите другой день.</p></div>}{Boolean(dayEvents?.length) && events?.length === 0 && <p role="status">В этот день нет событий выбранной категории.</p>}{events?.map(item => <article className="program-event" key={item.id}>
      <div className="program-event__time"><EventTime event={item} /></div><div><small className={`event-category event-category--${item.event_type}`}>{eventTypes[item.event_type]}</small>
        <button className="content-open" onClick={() => openEvent(item.id)}><strong>{item.title}</strong>{item.location && <span>{item.location.name}</span>}{item.image_urls[0] && <img src={item.image_urls[0]} alt="" loading="lazy" />}</button>
        {item.event_type === 'stage_finish' && item.stage_id && <ArrivalEstimate stageId={item.stage_id} />}
        {item.location && <button className="text-action" onClick={() => { updateRoute({ view: 'watch', locationId: item.location!.id, eventId: undefined }); }}>Где смотреть</button>}
      </div></article>)}</>}
    {watch && <><RequestState resource={stage} /><LocationsScreen raceId={raceId} items={locations.data} route={stage.data} onSelect={openPlace} />{locations.data?.map(item => <article className="venue-card" key={item.id}>
      <button className="content-open" onClick={() => openPlace(item.id)}><h3>{item.name}</h3>{item.image_urls[0] && <img src={item.image_urls[0]} alt="" loading="lazy" />}</button>
      {item.location_type === 'finish' && item.stage_id && <ArrivalEstimate stageId={item.stage_id} />}
      {events?.filter(event => event.location?.id === item.id).map(event => <p key={event.id}><EventTime event={event} /> · {event.title}</p>)}
      <div className="content-actions"><a className="route-link" href={locationRoute(item)} target="_blank" rel="noreferrer">Маршрут на Яндекс Картах</a><button aria-label={`Напоминания: ${item.name}`} onClick={() => updateRoute({ locationId: item.id, reminders: true, expanded: true })}>Напомнить</button></div>
    </article>)}</>}
    {route.eventId && !event && program.data && <p role="status">Событие не найдено.<button onClick={close}>Вернуться к программе</button></p>}
    {route.locationId && !place && locations.data && <p role="status">Локация не найдена.<button onClick={close}>Вернуться к программе</button></p>}
    {(event || place) && <ContentSheet title={event?.title || place!.name} expanded={Boolean(route.expanded)} onClose={close} onExpand={() => updateRoute({ expanded: !route.expanded })}>
      <PhotoCarousel urls={(event || place)!.image_urls} title={event?.title || place!.name} />
      <h2>{event?.title || place!.name}</h2>
      {event && <><p>{eventTypes[event.event_type]} · {raceDate(event.start_at)}</p><p><EventTime event={event} /></p>{event.location && <button className="text-action" onClick={() => { updateRoute({ eventId: undefined, locationId: event.location!.id, expanded: undefined }); }}>{event.location.name}</button>}<ReminderButton eventId={event.id} startAt={event.start_at} /></>}
      {(place || event?.location) && <a className="route-link" href={locationRoute((place || event!.location)!)} target="_blank" rel="noreferrer">Маршрут на Яндекс Картах</a>}
      {place?.location_type === 'finish' && place.stage_id && <ArrivalEstimate stageId={place.stage_id} />}
      <div className={route.expanded ? 'content-description' : 'content-description content-description--preview'}><h3>Описание</h3><p>{event?.description || place?.description || 'Описание пока не опубликовано.'}</p>{place?.address && <p>{place.address}</p>}{place?.how_to_get_there && <p>{place.how_to_get_there}</p>}</div>
      {place && <><button className="text-action" aria-pressed={Boolean(route.allEvents)} onClick={() => updateRoute({ allEvents: !route.allEvents, expanded: true })}>{route.allEvents ? 'События выбранного дня' : 'Все события на площадке'}</button>
        <button className="text-action" aria-pressed={Boolean(route.reminders)} onClick={() => updateRoute({ reminders: !route.reminders, expanded: true })}>Выбрать напоминания</button>
        {placeEvents.length === 0 && <p>Событий на площадке в этот день нет.</p>}{placeEvents.map(item => <article className="venue-event" key={item.id}><button className="text-action" onClick={() => openEvent(item.id)}>{raceDate(item.start_at)} · {item.title}</button><p><EventTime event={item} /></p>{route.reminders && <ReminderButton eventId={item.id} startAt={item.start_at} />}</article>)}
      </>}
    </ContentSheet>}
  </section>;
}
