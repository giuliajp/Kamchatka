import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import bridge from '@vkontakte/vk-bridge';
import { AppProviders } from '../src/app/AppProviders';
import { ResultsScreen } from '../src/screens/Results/ResultsScreen';
import { TrackScreen } from '../src/screens/Content/TrackScreen';
import { ParticipantSheet } from '../src/components/ParticipantSheet';
import { Onboarding } from '../src/components/Onboarding';
import { App } from '../src/App';
import { fixtureResponse, participant, person, race, stage, standing, track } from './fixtures';
import { updateRoute } from '../src/api/navigation';
import type { MapCanvasProps } from '../src/screens/Map/MapCanvas';
vi.mock('@vkontakte/vk-bridge',()=>({default:{isEmbedded:vi.fn(()=>true),send:vi.fn().mockResolvedValue({result:true}),subscribe:vi.fn(),unsubscribe:vi.fn()}}));
vi.mock('../src/screens/Map/MapCanvas',()=>({MapCanvas:({data,onRefresh,onSelect,onCluster,track}:MapCanvasProps)=><div aria-label="Карта трека"><span>{data.bounds.toBBoxString()}</span><p>{track?.points.length} GPS-точек</p><button onClick={()=>{onRefresh();onSelect({} as never);onCluster([]);}}>Обновить трек</button></div>}));
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();localStorage.clear();history.replaceState(null,'','/');});
const finish={stage_id:103,stage_number:3,stage_checkpoint_id:300,order_index:2,role:'finish',label:'Финиш',name:'Пиначево',km_from_start:40,required_rest_minutes:30,arrived_at:'2026-11-03T04:00Z',departed_at:null};
function api(overrides:Record<string,unknown>={}) {
 const fetcher=vi.fn(async(input:RequestInfo|URL)=>{const path=String(input).replace('/api','');const data=path in overrides?overrides[path]:path==='/me'?{vk_user_id:42,participant_id:501,race_entries:[{race_id:10,race_participant_id:9001,start_number:14}]}:path.includes('/checkpoint-passes')?[finish,{...finish,stage_checkpoint_id:299,order_index:1,role:'checkpoint',label:null,name:'КП-1'}]:path==='/photos/albums'?{items:[{id:55,title:'Авача 2026',size:2,url:'https://vk.com/album-1_55',cover_url:null},{id:56,title:null,size:0,url:'https://vk.com/album-1_56',cover_url:null}],stale:true}:path.startsWith('/photos?')?{days:[{date:'2026-11-03',photos:[{id:'-1_1',date:'2026-11-03T01:00Z',text:null,url:'https://example.org/photo.jpg',vk_url:'https://vk.com/photo-1_1'},{id:'-1_2',date:'2026-11-03T01:00Z',text:'Каюры',url:null,vk_url:'https://vk.com/photo-1_2'}]}],stale:true}:fixtureResponse(path);return new Response(JSON.stringify({data,error:null}));});vi.stubGlobal('fetch',fetcher);return fetcher;
}
const click=async(name:string|RegExp)=>userEvent.click(await screen.findByRole('button',{name}));
it('labels the latest finish among stages in the overall standings and the selected stage finish',async()=>{
 const first={...finish,stage_id:101,stage_number:1,stage_checkpoint_id:100,arrived_at:'2026-11-01T04:00Z'};
 const later={...finish,stage_id:104,stage_number:4,stage_checkpoint_id:400,arrived_at:'2026-11-04T04:00Z'};
 api({'/races/10/results':{...fixtureResponse('/races/10/results') as object,disciplines:[{discipline:race.disciplines[0],stages:[],rows:[{...standing,stages:[{...standing.stages[0],stage_number:1},...standing.stages]}]}]},'/race-participants/9001/checkpoint-passes':[first,finish,later],'/race-participants/9001/checkpoint-passes?stage_id=103':[first,finish,later]});
 const {rerender}=render(<AppProviders><ResultsScreen race={race} raceId={10} stageId={undefined} stageNumber={undefined} discipline="" onSelect={vi.fn()}/></AppProviders>);
 const own=(await screen.findByRole('heading',{name:'Мой результат'})).closest('section')!;
 expect(await within(own).findByText(/Финиш этапа 3 · 03.11/)).toBeVisible();
 expect(within(own).queryByText(/Финиш этапа 4/)).not.toBeInTheDocument();
 rerender(<AppProviders><ResultsScreen race={race} raceId={10} stageId={103} stageNumber={3} discipline="" onSelect={vi.fn()}/></AppProviders>);
 expect(await screen.findByText(/Финиш этапа 3 · 03.11/)).toBeVisible();
});
it('shows own published stage results, the athlete mark, checkpoint details and the own card',async()=>{
 api();const select=vi.fn();render(<AppProviders><ResultsScreen race={race} raceId={10} stageId={103} stageNumber={3} discipline="sled_8" onSelect={select}/></AppProviders>);
 const own=await screen.findByRole('heading',{name:'Мой результат'});expect(own).toBeVisible();expect(screen.getByText('Вы')).toBeVisible();await userEvent.click(screen.getByText('Прохождение контрольных пунктов (КП)',{selector:'summary'}));expect(await screen.findByText(/Финиш: 03.11/)).toBeVisible();await click('Моя карточка');expect(select).toHaveBeenCalledWith(501,9001);await click(/2. Алиса Иванова/);expect(select).toHaveBeenCalledTimes(2);
});
it('does not identify another season or person as the logged-in athlete',async()=>{
 api({'/me':{vk_user_id:42,participant_id:999,race_entries:[{race_id:10,race_participant_id:9001,start_number:14}]}});render(<AppProviders><ResultsScreen raceId={10} stageId={undefined} stageNumber={undefined} discipline="" onSelect={vi.fn()}/></AppProviders>);await screen.findByText(/Штрафы уже/);expect(screen.queryByRole('heading',{name:'Мой результат'})).not.toBeInTheDocument();
});
it('downloads and saves stage PDFs and shows unavailable race PDFs before the race finishes',async()=>{
 api({'/stages/103':{...stage,protocol_pdf_url:'https://example.org/stage.pdf'}});const {rerender}=render(<AppProviders><ResultsScreen race={race} raceId={10} stageId={103} stageNumber={3} discipline="" onSelect={vi.fn()}/></AppProviders>);await click('Протокол');expect(await screen.findByRole('link',{name:'Скачать протокол в формате .pdf'})).toHaveAttribute('href','https://example.org/stage.pdf');
 await userEvent.click(screen.getByRole('button',{name:'Сохранить'}));expect(await screen.findByRole('alert')).toHaveTextContent('Данные сервера');
 rerender(<AppProviders><ResultsScreen race={race} raceId={10} stageId={undefined} stageNumber={undefined} discipline="" onSelect={vi.fn()}/></AppProviders>);expect(await screen.findByText('PDF протокола пока не опубликован.')).toBeVisible();
 rerender(<AppProviders><ResultsScreen race={{...race,status:'finished',protocol_pdf_url:'https://example.org/race.pdf'}} raceId={10} stageId={undefined} stageNumber={undefined} discipline="" onSelect={vi.fn()}/></AppProviders>);expect(await screen.findByRole('link',{name:'Скачать протокол в формате .pdf'})).toHaveAttribute('href','https://example.org/race.pdf');await click('Архив протоколов прошлых лет');expect(await screen.findByRole('heading',{name:'Архив прошлых лет'})).toBeVisible();
});
it('opens archived seasons and album photos and restores archive choices in the URL',async()=>{
 const old={...race,id:11,name:'Гонка 2025',year:2025,status:'finished' as const,protocol_pdf_url:'https://example.org/archive.pdf'};api({'/races':[race,old],'/races/11':old});render(<AppProviders><ResultsScreen race={race} raceId={10} stageId={undefined} stageNumber={undefined} discipline="" onSelect={vi.fn()}/></AppProviders>);await click('Архив прошлых лет');await click('Гонка 2025 · 2025');expect(await screen.findByRole('link',{name:'Скачать архив протокола .pdf'})).toHaveAttribute('href',old.protocol_pdf_url);expect(location.hash).toContain('archiveRace=11');await click('Авача 2026 · 2');expect(await screen.findByRole('img',{name:'Фото гонки'})).toBeVisible();expect(screen.getByText('Каюры')).toBeVisible();expect(screen.getByText('Сохранённая версия фото VK')).toBeVisible();await click('Фото гонки · 0');await click('Открыть результаты сезона');expect(location.hash).toContain('race=11');
});
it('shows empty archives and no PDF for an unfinished archive season',async()=>{
 const old={...race,id:11,name:'Гонка 2025',year:2025,protocol_pdf_url:null};api({'/races':[old],'/races/11':old,'/photos/albums':{items:[],stale:false},'/photos?album_id=55':{days:[],stale:false}});history.replaceState(null,'','/#view=archive&album=55');render(<AppProviders><ResultsScreen raceId={10} stageId={undefined} stageNumber={undefined} discipline="" onSelect={vi.fn()}/></AppProviders>);expect(await screen.findByText('Альбомы пока не опубликованы.')).toBeVisible();expect(await screen.findByText('Фотографий пока нет.')).toBeVisible();await click('Гонка 2025 · 2025');expect(await screen.findByText('PDF протокола пока не опубликован.')).toBeVisible();
});
it('renders a public track with official totals and shares a link that restores that same stage and person',async()=>{
 const fetcher=api();render(<AppProviders><TrackScreen race={race} stageId={103} entryId={9001}/></AppProviders>);expect(await screen.findByLabelText('Карта трека')).toBeVisible();expect(screen.getByText('Итоговое время за гонку: 00:16:40')).toBeVisible();await click('Обновить трек');await click('Опубликовать результаты');expect(await screen.findByText('Ссылка отправлена')).toBeVisible();expect(bridge.send).toHaveBeenCalledWith('VKWebAppShare',{link:expect.stringContaining('view=track')});expect(fetcher).toHaveBeenCalledWith('/api/race-participants/9001/track?stage=3',expect.anything());await click('← Назад к результатам');expect(location.hash).toContain('summaries');
});
it('supports GPS-only track bounds, empty tracks, missing participants and missing route metadata',async()=>{
 api({'/stages/103':{...stage,route_geojson:null,checkpoints:[]},'/race-participants/9001/track?stage=3':{...track,points:[{...track.points[0],latitude:99},...track.points]}});const {rerender}=render(<AppProviders><TrackScreen race={race} stageId={103} entryId={9001}/></AppProviders>);expect(await screen.findByLabelText('Карта трека')).toBeVisible();
 api({'/race-participants/9001/track':{...track,points:[]},'/races/10/participants':[{...participant,total_time:null,place:null}]});rerender(<AppProviders><TrackScreen race={race} entryId={9001}/></AppProviders>);expect(await screen.findByText('Подтверждённых точек трека пока нет.')).toBeVisible();expect(screen.getByText('Маршрут пока не опубликован.')).toBeVisible();act(()=>window.dispatchEvent(new Event('avacha:changed')));expect(await screen.findByText('Итоговое время за гонку: —')).toBeVisible();
 rerender(<AppProviders><TrackScreen race={race} stageId={999} entryId={999}/></AppProviders>);expect(await screen.findByText('Участник не найден в этом сезоне.')).toBeVisible();
});
it('uses own card track actions, dog breed and real penalty reasons and hides daily fan growth after finish',async()=>{
 const detail={...person,races:[{...person.races[0],race:{...race,status:'finished' as const},dog_breed:'Ездовые лайки',penalties:standing.penalties},{...person.races[0],race_participant_id:9999,race:{...race,id:11},penalties:[]}]};api({'/participants/501':detail});render(<AppProviders><ParticipantSheet participantId={501} entryId={9001} raceId={10} stage={stage} threshold={45} onClose={vi.fn()}/></AppProviders>);expect(await screen.findByText(/Ездовые лайки/)).toBeVisible();expect(await screen.findByText(/Нарушение правил/)).toBeVisible();expect(screen.queryByText(/за сутки/)).not.toBeInTheDocument();await click('Трек на карте');expect(location.hash).toContain('view=track');
});
it('runs all seven onboarding steps once, traps focus, and restores the incoming link on completion or Escape',async()=>{
 api();history.replaceState(null,'','/#race=10&section=program&day=2027-02-05');const done=vi.fn();const {unmount}=render(<AppProviders><Onboarding onFinish={done}/></AppProviders>);await click('Начать');const dialog=screen.getByRole('dialog',{name:'Знакомство с приложением'});const next=within(dialog).getByRole('button',{name:'Далее'});next.focus();fireEvent.keyDown(next,{key:'Tab'});expect(within(dialog).getByRole('button',{name:'Пропустить'})).toHaveFocus();fireEvent.keyDown(document.activeElement!,{key:'Tab',shiftKey:true});expect(next).toHaveFocus();fireEvent.keyDown(next,{key:'Tab',shiftKey:true});
 for(let i=0;i<6;i++)await click('Далее');await click('Готово');expect(done).toHaveBeenCalledOnce();expect(location.hash).toContain('day=2027-02-05');expect(location.hash).toContain('section=program');unmount();
 render(<AppProviders><Onboarding onFinish={done}/></AppProviders>);await click('Начать');fireEvent.keyDown(screen.getByRole('dialog',{name:'Знакомство с приложением'}),{key:'Escape'});expect(done).toHaveBeenCalledTimes(2);
});
it('opens a shared track route in the full app instead of a participant overlay',async()=>{
 api();history.replaceState(null,'','/#race=10&stage=103&person=501&participant=9001&section=results&view=track');render(<App/>);expect(await screen.findByRole('heading',{name:'Трек участника'})).toBeVisible();expect(screen.queryByRole('dialog',{name:'Карточка участника'})).not.toBeInTheDocument();await click('← Назад к результатам');expect(await screen.findByRole('dialog',{name:'Карточка участника'})).toBeVisible();
 act(()=>updateRoute({section:'results',view:'summaries',entryId:undefined,participantId:undefined}));await screen.findByRole('heading',{name:'Мой результат'});await click('Моя карточка');await screen.findByRole('dialog',{name:'Карточка участника'});await userEvent.keyboard('{Escape}');await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
it('shows a pending own result with no judge marks, no placing and a real participant photo',async()=>{
 const pending={...standing,place:null,total_time:null,status:'active' as const};api({'/races/10/results':{...fixtureResponse('/races/10/results') as object,disciplines:[{discipline:race.disciplines[0],stages:[],rows:[pending]}]},'/race-participants/9001/checkpoint-passes':[],'/races/10/participants':[{...participant,photo_url:'https://example.org/athlete.jpg'}]});render(<AppProviders><ResultsScreen race={race} raceId={10} stageId={undefined} stageNumber={undefined} discipline="" onSelect={vi.fn()}/></AppProviders>);expect(await screen.findByRole('heading',{name:'Мой результат'})).toBeVisible();await userEvent.click(screen.getByText('Прохождение контрольных пунктов (КП)',{selector:'summary'}));expect(await screen.findByText('Судейских отметок пока нет.')).toBeVisible();await waitFor(()=>expect(document.querySelector('.results-cards img')).toHaveAttribute('src','https://example.org/athlete.jpg'));expect(screen.getByRole('button',{name:/На дистанции. Алиса Иванова/})).toBeVisible();
});
it('keeps participant selection usable in a season without disciplines',async()=>{
 api({'/races/10':{...race,disciplines:[]}});history.replaceState(null,'','/#race=10&section=participants');render(<App/>);await screen.findByRole('heading',{name:race.name});await userEvent.click(await screen.findByRole('tab',{name:/Мои/}));expect(location.hash).toContain('mine=1');
});
it('opens the own track straight from the personal result without changing the selected stage',async()=>{
 api();render(<AppProviders><ResultsScreen race={race} raceId={10} stageId={103} stageNumber={3} discipline="" onSelect={vi.fn()}/></AppProviders>);await click('Мой трек');expect(location.hash).toContain('view=track');expect(location.hash).toContain('stage=103');expect(location.hash).toContain('participant=9001');
});
it('selects an independent participant discipline and restores the map filter',async()=>{
 api();history.replaceState(null,'','/#race=10&section=map&discipline=sled_8');render(<App/>);await click('Участники');await userEvent.click(await screen.findByRole('tab',{name:/Дисциплина:/}));await userEvent.click(await screen.findByRole('radio',{name:'Лыжи, 2 собаки'}));expect(location.hash).toContain('discipline=ski_2');await click('Карта');expect(location.hash).toContain('discipline=sled_8');await click('Участники');expect(location.hash).toContain('discipline=ski_2');
});
it('restores a participants discipline from a direct link',async()=>{
 api();history.replaceState(null,'','/#race=10&section=participants&discipline=ski_2');render(<App/>);expect(await screen.findByRole('tab',{name:'Дисциплина: Лыжи, 2 собаки'})).toBeVisible();
});
