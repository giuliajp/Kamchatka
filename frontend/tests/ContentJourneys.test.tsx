import {render,screen,fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import L from 'leaflet';
import {AppProviders} from '../src/app/AppProviders';
import {MoreScreen} from '../src/screens/Content/MoreScreen';
import {RouteScreen} from '../src/screens/Content/RouteScreen';
import {LocationsScreen} from '../src/screens/Content/LocationsScreen';
import {ProgramScreen} from '../src/screens/Content/ProgramScreen';
import {programEvent,spectatorLocation,faq,contact} from '../src/stories/contentFixtures';
import {fixtureResponse,race,stage,mockApi,positions} from './fixtures';
vi.mock('../src/screens/Map/MapCanvas',()=>({MapCanvas:({onRefresh,onSelect,onCluster}:import('../src/screens/Map/MapCanvas').MapCanvasProps)=><button onClick={()=>{onRefresh();onSelect(positions.participants[0]);onCluster([]);}}>Обновить карту</button>}));
vi.mock('leaflet',async original=>{const actual=await original<{default:typeof L}>();return{...actual,default:{...actual.default,map:vi.fn(()=>({fitBounds:vi.fn(),remove:vi.fn()})),tileLayer:vi.fn(()=>({addTo:vi.fn()})),circleMarker:vi.fn(()=>({bindPopup:vi.fn().mockReturnThis(),addTo:vi.fn().mockReturnThis()})),featureGroup:vi.fn(()=>({getBounds:vi.fn()}))}};});
afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();});
const click=(name:string)=>userEvent.click(screen.getByRole('button',{name}));
it('visits More sections and renders published FAQ/contact fields',async()=>{
 mockApi(url=>url.includes('/faq')?[faq]:url.includes('/contacts')?[contact,{...contact,id:2,title:'Без контактов',name:null,phone:null,email:null,url:null}]:fixtureResponse(url));render(<AppProviders><MoreScreen race={race}/></AppProviders>);
 await userEvent.click(screen.getByText('FAQ',{selector:'summary'}));await userEvent.click(await screen.findByText(faq.question));expect(screen.getByText(faq.answer)).toBeVisible();
 expect(await screen.findByRole('link',{name:contact.phone!})).toHaveAttribute('href','tel:+70000000000');expect(screen.getByRole('link',{name:contact.email!})).toHaveAttribute('href','mailto:organizer%40example.org');expect(screen.getByRole('link',{name:'Сайт'})).toHaveAttribute('href','https://example.org/');
 for(const name of ['Новости и фото','Мой профильПерейти к настройкам →','Зрительские локации','Маршрут и высоты']){await click(name);expect(await screen.findByRole('button',{name:'← Ещё'})).toBeVisible();await click('← Ещё');}
});
it('shows honest empty FAQ and contacts',async()=>{mockApi();render(<AppProviders><MoreScreen race={race}/></AppProviders>);await userEvent.click(screen.getByText('FAQ',{selector:'summary'}));expect(await screen.findByText('Ответы пока не опубликованы.')).toBeVisible();expect(await screen.findByText('Контакты пока не опубликованы.')).toBeVisible();});
it('maps published spectator locations with safe text labels and removes the map on season change',async()=>{
 const overrides=(url:string)=>url.includes('race_id=10')?[spectatorLocation,{...spectatorLocation,id:2,name:'<script>Test</script>',description:null,address:null,how_to_get_there:null}]:url.includes('/locations')?[]:fixtureResponse(url);mockApi(overrides);const {rerender}=render(<AppProviders><LocationsScreen raceId={10}/></AppProviders>);expect(await screen.findByText(spectatorLocation.how_to_get_there!)).toBeVisible();expect(screen.getByLabelText('Карта зрительских локаций')).toBeVisible();expect(L.circleMarker).toHaveBeenCalledWith([53.1,158.4],expect.anything());const map=vi.mocked(L.map).mock.results.at(-1)!.value;rerender(<AppProviders><LocationsScreen raceId={11}/></AppProviders>);expect(await screen.findByText('Локации пока не опубликованы.')).toBeVisible();expect(map.remove).toHaveBeenCalledOnce();expect(screen.queryByLabelText('Карта зрительских локаций')).not.toBeInTheDocument();
});
it('shows actual route heights, required rest and unpublished route states across stages',async()=>{
 const fetcher=mockApi(url=>url.endsWith('/stages/102')?{...stage,elevation_profile:[{km:0,elevation_m:100},{km:40,elevation_m:200}],checkpoints:[{...stage.checkpoints[0],label:null,required_rest_minutes:45,segment_description:'Тестовое описание участка'}]}:url.endsWith('/stages/103')?{...stage,route_geojson:null,checkpoints:[]}:fixtureResponse(url));render(<AppProviders><RouteScreen race={race}/></AppProviders>);expect(await screen.findByRole('img',{name:'Профиль высот маршрута'})).toBeVisible();expect(screen.getByText('0 км · Обязательный отдых: 45 мин')).toBeVisible();expect(screen.getByText('Тестовое описание участка')).toBeVisible();await click('Обновить карту');expect(fetcher).toHaveBeenCalledWith('/api/stages/102',expect.anything());await userEvent.selectOptions(screen.getByLabelText('Этап маршрута'),'103');expect(await screen.findByText('Маршрут пока не опубликован.')).toBeVisible();expect(screen.getByText('Профиль высот пока не опубликован.')).toBeVisible();
});
it('handles a season without stages and a day without events',async()=>{
 mockApi(url=>url.includes('/program')?[programEvent,{...programEvent,id:2,title:'Фестиваль',start_at:'2026-11-05T01:00Z',event_type:'festival',location:{...spectatorLocation,address:null},end_at:null,description:null}]:fixtureResponse(url));const {unmount}=render(<AppProviders><RouteScreen race={{...race,stages:[]}}/></AppProviders>);expect(screen.getByLabelText('Этап маршрута').querySelectorAll('option')).toHaveLength(0);unmount();render(<AppProviders><ProgramScreen raceId={10}/></AppProviders>);
 fireEvent.change(screen.getByLabelText('День программы'),{target:{value:'2026-11-03'}});await screen.findByRole('button',{name:/Старт этапа/});fireEvent.change(screen.getByLabelText('День программы'),{target:{value:'2026-11-04'}});expect(await screen.findByText('Сегодня участники отдыхают')).toBeVisible();fireEvent.change(screen.getByLabelText('День программы'),{target:{value:'2026-11-05'}});expect(await screen.findByRole('button',{name:/Фестиваль/})).toBeVisible();
});
