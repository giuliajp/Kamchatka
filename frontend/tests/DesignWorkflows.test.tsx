import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import bridge from '@vkontakte/vk-bridge';
import L from 'leaflet';
import { AppProviders } from '../src/app/AppProviders';
import { ProgramScreen, programDays, dayKey } from '../src/screens/Content/ProgramScreen';
import { ReminderButton } from '../src/screens/Content/ReminderButton';
import { ArrivalEstimate } from '../src/screens/Content/ArrivalEstimate';
import { ContentSheet, PhotoCarousel } from '../src/components/ContentSheet';
import { MoreScreen } from '../src/screens/Content/MoreScreen';
import { ProfileScreen } from '../src/screens/Content/ProfileScreen';
import { fixtureResponse, race } from './fixtures';
import { programEvent, spectatorLocation } from '../src/stories/contentFixtures';
import { updateRoute } from '../src/api/navigation';
vi.mock('@vkontakte/vk-bridge',()=>({default:{isEmbedded:vi.fn(()=>true),send:vi.fn().mockResolvedValue({result:true})}}));
vi.mock('leaflet',async original=>{const actual=await original<{default:typeof L}>();return{...actual,default:{...actual.default,map:vi.fn(()=>({fitBounds:vi.fn(),remove:vi.fn(),addLayer:vi.fn()})),tileLayer:vi.fn(()=>({addTo:vi.fn()})),circleMarker:vi.fn(()=>({bindPopup:vi.fn().mockReturnThis(),addTo:vi.fn().mockReturnThis(),on:vi.fn().mockReturnThis()})),featureGroup:vi.fn(()=>({getBounds:vi.fn()}))}};});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();localStorage.clear();history.replaceState(null,'','/');});
const place={...spectatorLocation,id:3,location_type:'finish' as const,stage_id:103,image_urls:['https://example.org/venue.jpg']};
const event={...programEvent,id:5,event_type:'master_class' as const,title:'Мастер-класс для детей',start_at:'2027-02-05T01:00Z',end_at:'2027-02-05T03:00Z',location:place,image_urls:['https://example.org/event.jpg']};
const second={...event,id:6,title:'Вечер каюров',event_type:'meeting' as const,start_at:'2027-02-06T06:00Z',end_at:null};
const estimate={stage_id:103,generated_at:'2027-02-05T01:00Z',tracking_interval_minutes:20,first:{from:'2027-02-05T04:00Z',to:'2027-02-05T04:30Z'},leaders:[],note:'Оценка по GPS-трекерам, время может измениться'};
function server({login=true,allowed=true,selected=false}:{login?:boolean;allowed?:boolean;selected?:boolean}={}) {
 let reminders=selected?[5]:[];let settings={notifications_allowed:allowed,checkpoints:true,results:false,news:true};
 const writes:{path:string;method:string;body:unknown}[]=[];let fail=false;
 const fetcher=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const path=String(input).replace('/api','');const method=init?.method || 'GET';let data:unknown;
  if(path==='/me/visit'&&!login)return new Response(JSON.stringify({error:{message:'Вход через VK'}}),{status:401});
  if(method!=='GET'){const body=init?.body?JSON.parse(String(init.body)):undefined;writes.push({path,method,body});
   if(path.endsWith('/reminder')){if(fail)return new Response(JSON.stringify({error:{message:'Напоминание не сохранено'}}),{status:409});reminders=method==='DELETE'?[]:[5];data={program_event_id:5,reminder:method!=='DELETE'};}
   else if(path==='/me/notification-settings'){settings={...settings,...body};data=settings;}
   else if(path==='/me/notifications'){settings.notifications_allowed=body.allowed;data={notifications_allowed:body.allowed};}
   else data=fixtureResponse(path);
  }else data=path.includes('/program?')?[event,second]:path.includes('/locations?')?[place]:path==='/me/reminders'?{program_event_ids:reminders}:path==='/me/notification-settings'?settings:path.endsWith('/arrival-estimate')?estimate:path==='/guest-info'?{how_to_get_there:[{id:1,title:'Самолётом',text:'До аэропорта Елизово.'}],what_to_bring:[{id:2,title:'Одежда',text:'Тёплая куртка.'}],safety:[{id:3,title:null,text:'Не выходите на трассу.'}]}:fixtureResponse(path);
  return new Response(JSON.stringify({data,error:null}));
 });vi.stubGlobal('fetch',fetcher);return{fetcher,writes,setFailure:(v:boolean)=>{fail=v;}};
}
const click=async(name:string|RegExp)=>userEvent.click(await (name === 'Где смотреть' ? within(screen.getByRole('group',{name:'Вид программы'})) : screen).findByRole('button',{name}));
it('follows event and venue arrows, expands photos, restores the day and selects venue reminders',async()=>{
 const api=server();render(<AppProviders><ProgramScreen raceId={10}/></AppProviders>);
 await click(awaitName('Мастер-класс для детей'));
 const dialog=await screen.findByRole('dialog',{name:event.title});expect(within(dialog).getByRole('region',{name:`Фотографии: ${event.title}`})).toBeVisible();
 expect(within(dialog).getByRole('link',{name:'Маршрут на Яндекс Картах'})).toHaveAttribute('href','https://yandex.ru/maps/?rtext=~53.1,158.4&rtt=auto');
 await userEvent.click(within(dialog).getByRole('button',{name:'Подробнее'}));expect(location.hash).toContain('expanded=1');
 await userEvent.click(within(dialog).getByRole('button',{name:'Свернуть'}));
 await userEvent.click(within(dialog).getByRole('button',{name:place.name}));
 const venue=await screen.findByRole('dialog',{name:place.name});expect(within(venue).getByText('Тестовый маршрут проезда.')).toBeInTheDocument();
 await userEvent.click(within(venue).getByRole('button',{name:'Все события на площадке'}));
 const allEvents=screen.getByRole('region',{name:'Все события на площадке'});expect(await within(allEvents).findByRole('button',{name:'Вечер каюров'})).toBeVisible();
 await userEvent.click(within(allEvents).getByRole('button',{name:'Выбрать напоминания'}));expect(within(allEvents).getAllByRole('button',{name:'Напомнить о событии'})).toHaveLength(2);
 await userEvent.click(within(allEvents).getAllByRole('button',{name:'Напомнить о событии'})[0]);expect(await within(allEvents).findByRole('button',{name:'Отменить напоминание'})).toBeVisible();expect(api.writes.some(write=>write.path==='/program/5/reminder')).toBe(true);
 await userEvent.click(within(allEvents).getByRole('button',{name:'← Назад к локации'}));
 const restored=await screen.findByRole('dialog',{name:place.name});await userEvent.click(within(restored).getByRole('button',{name:'Закрыть карточку'}));expect(await screen.findByRole('dialog',{name:event.title})).toBeVisible();
 await click('Закрыть карточку');await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
 await click('Где смотреть');expect(await screen.findByLabelText('Карта зрительских локаций')).toBeVisible();expect(await screen.findByText('≈16:00 – 16:30')).toBeVisible();
 const marker=vi.mocked(L.circleMarker).mock.results.at(-1)!.value;act(()=>{vi.mocked(marker.on).mock.calls[0][1]();});expect(await screen.findByRole('dialog',{name:place.name})).toBeVisible();
});
// Wait for the data-backed button rather than matching the loading skeleton.
function awaitName(name:string) { return new RegExp(name); }
it('preserves selected days, shows empty dates and handles direct missing content links',async()=>{
 server();history.replaceState(null,'','/#day=2027-02-07&event=999');render(<AppProviders><ProgramScreen raceId={10}/></AppProviders>);expect(await screen.findByText('Событие не найдено.')).toBeVisible();await click('Вернуться к программе');expect(screen.getByLabelText('День программы')).toHaveValue('2027-02-07');expect(await screen.findByText('Сегодня участники отдыхают')).toBeVisible();
 fireEvent.change(screen.getByLabelText('День программы'),{target:{value:'2027-02-06'}});await click(/Вечер каюров/);expect(await screen.findByRole('dialog',{name:'Вечер каюров'})).toBeVisible();await click('Закрыть карточку');await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
 await click('Где смотреть');await click(`Напоминания: ${place.name}`);const venue=await screen.findByRole('dialog',{name:place.name});expect(within(venue).getByRole('button',{name:'Напомнить о событии'})).toBeVisible();
 act(()=>updateRoute({eventId:undefined,locationId:999}));expect(await screen.findByText('Локация не найдена.')).toBeVisible();await click('Вернуться к программе');await click('Расписание');expect(await screen.findByRole('button',{name:/Вечер каюров/})).toBeVisible();
});
it('uses server reminders, leaves confirmed state on write failures and allows cancellation',async()=>{
 const api=server({selected:true});render(<AppProviders><ReminderButton eventId={5} startAt={event.start_at}/></AppProviders>);const button=await screen.findByRole('button',{name:'Отменить напоминание'});api.setFailure(true);await userEvent.click(button);expect(await screen.findByRole('alert')).toHaveTextContent('Напоминание не сохранено');expect(button).toHaveAttribute('aria-pressed','true');api.setFailure(false);await userEvent.click(button);await screen.findByRole('button',{name:'Напомнить о событии'});await click('Напомнить о событии');await screen.findByRole('button',{name:'Отменить напоминание'});
});
it('requests permission for reminders and never writes after VK declines',async()=>{
 const api=server({allowed:false});vi.mocked(bridge.send).mockResolvedValueOnce({result:false});render(<AppProviders><ReminderButton eventId={5} startAt={event.start_at}/></AppProviders>);const button=await screen.findByRole('button',{name:'Напомнить о событии'});await waitFor(()=>expect(button).toBeEnabled());await userEvent.click(button);expect(await screen.findByRole('alert')).toHaveTextContent('Разрешение не подтверждено');expect(api.writes.some(w=>w.path.endsWith('/reminder'))).toBe(false);await userEvent.click(button);expect(await screen.findByRole('button',{name:'Отменить напоминание'})).toBeVisible();
});
it('explains guest reminder access and disables reminders once an event starts',async()=>{
 server({login:false});const {rerender}=render(<AppProviders><ReminderButton eventId={5} startAt={event.start_at}/></AppProviders>);const button=screen.getByRole('button',{name:'Напомнить о событии'});await waitFor(()=>expect(button).toBeEnabled());await userEvent.click(button);expect(await screen.findByRole('alert')).toHaveTextContent('Откройте приложение во ВКонтакте');rerender(<AppProviders><ReminderButton eventId={5} startAt="2020-01-01T00:00Z"/></AppProviders>);expect(screen.getByText('Событие уже началось')).toBeVisible();expect(button).toBeDisabled();
});
it('handles unavailable estimates, renders guest information and saves only changed profile toggles',async()=>{
 const api=server();const original=fetch;vi.stubGlobal('fetch',vi.fn((input,init)=>String(input).endsWith('/arrival-estimate')?Promise.resolve(new Response(JSON.stringify({data:{...estimate,first:null}}))):original(input,init)));
 const {unmount}=render(<AppProviders><ArrivalEstimate stageId={103}/><MoreScreen race={race}/></AppProviders>);expect(await screen.findByText('Оценка прибытия пока недоступна.')).toBeVisible();await userEvent.click(screen.getByText('Гостям',{selector:'summary'}));expect(await screen.findByText('До аэропорта Елизово.')).toBeVisible();expect(screen.getByText('Тёплая куртка.')).toBeVisible();await userEvent.click(screen.getByText('Техника безопасности',{selector:'summary'}));expect(screen.getByText('Не выходите на трассу.')).toBeVisible();await click('Карта зрительских локаций');expect(location.hash).toContain('view=watch');unmount();
 vi.mocked(bridge.send).mockResolvedValueOnce({id:42,first_name:'Ирина',last_name:'Петрова',photo_100:'https://example.org/avatar.jpg'} as never);render(<AppProviders><ProfileScreen raceId={10}/></AppProviders>);expect(await screen.findByText('Ирина Петрова')).toBeVisible();const toggle=screen.getByRole('switch',{name:/Прохождение КП/});await userEvent.click(toggle);await waitFor(()=>expect(toggle).not.toBeChecked());expect(api.writes).toContainEqual({path:'/me/notification-settings',method:'PUT',body:{checkpoints:false}});
});
it('closes a sheet by its handle, keeps keyboard photo links and bounds the calendar strip',async()=>{
 server();const close=vi.fn();render(<AppProviders><ContentSheet title="Карточка" expanded={false} onExpand={vi.fn()} onClose={close}><PhotoCarousel urls={['javascript:x','https://example.org/photo.jpg']} title="Площадка"/></ContentSheet></AppProviders>);const handle=document.querySelector('.content-sheet__handle')!;fireEvent.pointerDown(handle,{clientY:0});fireEvent.pointerUp(handle,{clientY:30});expect(close).not.toHaveBeenCalled();Object.defineProperty(handle,'setPointerCapture',{value:vi.fn()});fireEvent.pointerDown(handle,{clientY:0});fireEvent.pointerUp(handle,{clientY:150});expect(close).toHaveBeenCalled();expect(screen.getByRole('link',{name:'Открыть фото 1'})).toHaveAttribute('href','https://example.org/photo.jpg');
 expect(dayKey('2027-02-04T23:00Z')).toBe('2027-02-05');expect(programDays([event,second])).toEqual(['2027-02-05','2027-02-06']);expect(programDays([], {...race,start_date:'2027-01-01',end_date:'2028-12-31'})).toHaveLength(366);
});
it('opens venue cards from the schedule and watch list, selects a strip day and handles unpublished venue details',async()=>{
 const base=server();const original=fetch;const empty={...place,id:4,name:'КП у дороги',location_type:'checkpoint',description:null,address:null,how_to_get_there:null,image_urls:[]};
 vi.stubGlobal('fetch',vi.fn((input,init)=>String(input).includes('/locations?')?Promise.resolve(new Response(JSON.stringify({data:[place,empty]}))):String(input).includes('/program?')?Promise.resolve(new Response(JSON.stringify({data:[{...event,event_type:'stage_finish'},{...second,stage_id:null,event_type:'stage_finish'}]}))):original(input,init)));
 render(<AppProviders><ProgramScreen raceId={10}/></AppProviders>);await screen.findByRole('button',{name:/Мастер-класс для детей/});await userEvent.click(screen.getAllByRole('button',{name:'Где смотреть'})[1]);expect(await screen.findByRole('dialog',{name:place.name})).toBeVisible();await click('Закрыть карточку');await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
 await click('Где смотреть');await click(empty.name);const venue=await screen.findByRole('dialog',{name:empty.name});expect(within(venue).getByText('Описание пока не опубликовано.')).toBeVisible();expect(within(venue).getByText('Событий на площадке в этот день нет.')).toBeVisible();await click('Закрыть карточку');await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());await click(place.name);
 await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button',{name:/04.02|05.02|Мастер-класс/}));expect(await screen.findByRole('dialog',{name:event.title})).toBeVisible();await click('Закрыть карточку');await waitFor(()=>expect(screen.queryByRole('dialog',{name:event.title})).not.toBeInTheDocument());
 act(()=>updateRoute({locationId:undefined,eventId:undefined,day:'2027-02-06',view:'schedule'}));const strip=screen.getByRole('group',{name:'Дни программы'});await userEvent.click(within(strip).getByRole('button',{name:/5/}));expect(location.hash).toContain('day=2027-02-05');expect(base.fetcher).toHaveBeenCalled();
});
it('preserves category settings after VK declines and after API rejects a write, and opens saved protocol URLs',async()=>{
 const api=server({allowed:false});const original=fetch;let reject=false;
 const materials=[{kind:'protocol',item_id:'race:10',title:null,url:'https://example.org/race.pdf',image_url:null},{kind:'photo',item_id:'p',title:null,url:null,image_url:null},{kind:'news',item_id:'n',title:null,url:'https://vk.com/wall-1_1',image_url:null}];
 vi.stubGlobal('fetch',vi.fn((input,init)=>String(input).endsWith('/me/bookmarks')?Promise.resolve(new Response(JSON.stringify({data:materials.map(item=>({...item,created_at:event.start_at}))}))):reject&&String(input).endsWith('/notification-settings')&&init?.method==='PUT'?Promise.resolve(new Response(JSON.stringify({error:{message:'Не удалось сохранить настройки'}}),{status:503})):original(input,init)));
 vi.mocked(bridge.send).mockResolvedValueOnce({first_name:'Ирина',last_name:'Петрова',photo_100:''} as never);render(<AppProviders><ProfileScreen raceId={10}/></AppProviders>);expect(await screen.findByText('Ирина Петрова')).toBeVisible();expect(await screen.findByRole('link',{name:'Открыть сохранённый протокол'})).toHaveAttribute('href','https://example.org/race.pdf');expect(screen.getByText('Ссылка недоступна')).toBeVisible();expect(screen.getByRole('heading',{name:'Фото'})).toBeVisible();expect(screen.getByRole('heading',{name:'Новость'})).toBeVisible();
 const toggle=screen.getByRole('switch',{name:/Финиш и итоги/});vi.mocked(bridge.send).mockResolvedValueOnce({result:false});await userEvent.click(toggle);expect(await screen.findByRole('alert')).toHaveTextContent('Разрешение не подтверждено');expect(toggle).not.toBeChecked();expect(api.writes.some(write=>write.path==='/me/notification-settings')).toBe(false);
 reject=true;await userEvent.click(toggle);expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось сохранить настройки');expect(toggle).not.toBeChecked();reject=false;await userEvent.click(toggle);await waitFor(()=>expect(toggle).toBeChecked());
});
it('renders a titled safety item without inventing a heading for untitled guest items',async()=>{
 server();const original=fetch;vi.stubGlobal('fetch',vi.fn((input,init)=>String(input).endsWith('/guest-info')?Promise.resolve(new Response(JSON.stringify({data:{how_to_get_there:[{id:1,title:null,text:'Доехать автобусом.'}],what_to_bring:[{id:2,title:null,text:'Термос.'}],safety:[{id:3,title:'Собаки на трассе',text:'Не подходите к упряжке.'}]}}))):original(input,init)));
 render(<AppProviders><MoreScreen race={race}/></AppProviders>);await userEvent.click(screen.getByText('Техника безопасности',{selector:'summary'}));expect(await screen.findByRole('heading',{name:'Собаки на трассе'})).toBeVisible();
});
it('filters every category including new event kinds and keeps the selected day',async()=>{
 server();render(<AppProviders><ProgramScreen raceId={10}/></AppProviders>);await screen.findByRole('button',{name:/Мастер-класс для детей/});await userEvent.click(screen.getByText(/февраля,|февраля/,{selector:'.program-date>summary'}));const category=screen.getByRole('combobox',{name:'Категория'});await userEvent.selectOptions(category,'master_class');expect(screen.getByRole('button',{name:/Мастер-класс для детей/})).toBeVisible();await userEvent.selectOptions(category,'meeting');expect(screen.getByRole('status')).toHaveTextContent('В этот день нет событий выбранной категории.');expect(screen.queryByText('Сегодня участники отдыхают')).not.toBeInTheDocument();fireEvent.change(screen.getByLabelText('День программы'),{target:{value:'2027-02-06'}});expect(await screen.findByRole('button',{name:/Вечер каюров/})).toBeVisible();expect(location.hash).toContain('category=meeting');await userEvent.selectOptions(category,'');fireEvent.keyDown(category,{key:'ArrowDown'});expect(category.closest('details')).toHaveAttribute('open');fireEvent.keyDown(category,{key:'Escape'});expect(category.closest('details')).not.toHaveAttribute('open');
});
it('shows the end date of an overnight event in Kamchatka time',async()=>{
 server();const original=fetch;vi.stubGlobal('fetch',vi.fn((input,init)=>String(input).includes('/program?')?Promise.resolve(new Response(JSON.stringify({data:[{...event,end_at:'2027-02-06T01:00Z'}]}))):original(input,init)));render(<AppProviders><ProgramScreen raceId={10}/></AppProviders>);expect(await screen.findByText('13:00 – 06.02 13:00')).toBeVisible();
});
it('keeps server settings usable when VK cannot return an avatar',async()=>{
 server();vi.mocked(bridge.send).mockRejectedValueOnce(new Error('VK unavailable'));render(<AppProviders><ProfileScreen raceId={10}/></AppProviders>);expect(await screen.findByRole('switch',{name:/Прохождение КП/})).toBeVisible();expect(screen.getByText('Мой профиль')).toBeVisible();
});
