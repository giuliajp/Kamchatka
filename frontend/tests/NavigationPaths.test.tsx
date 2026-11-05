import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import {App} from '../src/App';
import {fixtureResponse,race,participant,mockApi} from './fixtures';
vi.mock('../src/screens/Map/MapCanvas',()=>({MapCanvas:()=> <div>Карта</div>}));
afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();history.replaceState(null,'','/');});
it('opens a participant-only push link after locating the season and loads real participant details',async()=>{
 history.replaceState(null,'','/#participant=9001');mockApi(url=>url.endsWith('/races')?[{...race,id:11,is_current:false},race]:url.includes('/races/10/participants')?[participant]:fixtureResponse(url));render(<App/>);expect(screen.getByText('Открываем участника…')).toBeVisible();expect(await screen.findByRole('dialog',{name:'Карточка участника'})).toBeVisible();expect(await screen.findByText(participant.full_name)).toBeVisible();
});
it('uses the linked stage’s season and resolves an entry when the season is already provided',async()=>{
 history.replaceState(null,'','/#map&stage=103');const fetcher=mockApi();render(<App/>);await screen.findByRole('heading',{name:race.name});expect(fetcher).toHaveBeenCalledWith('/api/stages/103',expect.anything());act(()=>{history.replaceState(null,'','/#race=10&participant=9001');fireEvent(window,new HashChangeEvent('hashchange'));});expect(await screen.findByRole('dialog',{name:'Карточка участника'})).toBeVisible();
});
it('reports a missing participant rather than opening an unrelated card',async()=>{history.replaceState(null,'','/#race=10&participant=999');mockApi();render(<App/>);expect(await screen.findByText('Участник не найден в этом сезоне. Выберите другой сезон.')).toBeVisible();expect(screen.queryByRole('dialog')).not.toBeInTheDocument();});
it.each([new Error('Не удалось найти сезон'),'failure'])('keeps current race accessible after a failed participant lookup (%s)',async failure=>{
 history.replaceState(null,'','/#participant=9001');vi.stubGlobal('fetch',vi.fn(async(url:string)=>{if(url.endsWith('/races'))throw failure;return new Response(JSON.stringify({data:fixtureResponse(url)}));}));render(<App/>);await screen.findByRole('heading',{name:race.name});expect(await screen.findByRole('alert')).toHaveTextContent(failure instanceof Error?failure.message:'Не удалось открыть ссылку');
});
it('ignores an outdated lookup after navigating to a different push link',async()=>{
 const finishes:((value:Response)=>void)[]=[];history.replaceState(null,'','/#participant=9001');vi.stubGlobal('fetch',vi.fn((url:string)=>url.endsWith('/races')?new Promise<Response>(resolve=>{finishes.push(resolve);}):Promise.resolve(new Response(JSON.stringify({data:fixtureResponse(url)})))));render(<App/>);act(()=>{history.replaceState(null,'','/#results&race=10');fireEvent(window,new HashChangeEvent('hashchange'));});expect(await screen.findByRole('heading',{name:'Общий зачёт'})).toBeVisible();await act(async()=>{for(const finish of finishes)finish(new Response(JSON.stringify({data:[race]})));});expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('remembers the first launch when the welcome dialog is dismissed',async()=>{
 localStorage.removeItem('avacha:welcome');mockApi(url=>url.endsWith('/races/current')?{...race,stages:[]}:fixtureResponse(url));render(<App/>);await screen.findByRole('button',{name:'Закрыть знакомство'});await userEvent.click(screen.getByRole('button',{name:'Закрыть знакомство'}));await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());expect(localStorage.getItem('avacha:welcome')).toBe('1');
});
it('ignores lookup failures after leaving the participant link',async()=>{
 const failures:((reason:unknown)=>void)[]=[];history.replaceState(null,'','/#participant=9001');vi.stubGlobal('fetch',vi.fn((url:string)=>url.endsWith('/races')?new Promise<Response>((_resolve,reject)=>{failures.push(reject);}):Promise.resolve(new Response(JSON.stringify({data:fixtureResponse(url)})))));const {unmount}=render(<App/>);unmount();await act(async()=>{failures.forEach(reject=>reject(new Error('Late network failure')));});expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('starts successfully when browser storage is unavailable',async()=>{
 vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('Storage blocked');});vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('Storage blocked');});mockApi(url=>url.endsWith('/races/current')?{...race,stages:[]}:fixtureResponse(url));render(<App/>);await userEvent.click(await screen.findByRole('button',{name:'Начать'}));await userEvent.click(screen.getByRole('button',{name:'Пропустить'}));await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());expect(screen.getByRole('navigation',{name:'Разделы гонки'})).toBeVisible();
});
