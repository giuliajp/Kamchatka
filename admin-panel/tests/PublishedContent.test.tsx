import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import {Supporters} from '../src/pages/Supporters';
import {PushPage} from '../src/pages/Push';
import {backend} from './backend';
import {fixtureData} from '../src/stories/fixtures';
afterEach(()=>vi.unstubAllGlobals());
const click=(name:string)=>userEvent.click(screen.getByRole('button',{name}));
it('exports fan dynamics only for a valid day range, refreshes rating and handles download failure',async()=>{
 const ratings=fixtureData('/races/1/support-rating') as Record<string,unknown>[];const {fetcher}=backend({'/races/1/support-rating':[...ratings,{...ratings[0],race_participant_id:99,rank:4,change_24h:-1}]});render(<Supporters raceId={1}/>);await screen.findByRole('region',{name:'Рейтинг болельщиков'});await screen.findByText('-1');fireEvent.change(screen.getByLabelText('Дней в выгрузке'),{target:{value:'0'}});expect(screen.getByRole('button',{name:'Скачать динамику CSV'})).toBeDisabled();fireEvent.change(screen.getByLabelText('Дней в выгрузке'),{target:{value:'91'}});expect(screen.getByRole('button',{name:'Скачать динамику CSV'})).toBeDisabled();fireEvent.change(screen.getByLabelText('Дней в выгрузке'),{target:{value:'30'}});fetcher.mockResolvedValueOnce(new Response('',{status:503}));await click('Скачать динамику CSV');expect(await screen.findByRole('alert')).toHaveTextContent('503');await click('Обновить рейтинг');expect(fetcher).toHaveBeenCalledWith('/api/races/1/support-rating',expect.anything());
});
it('shows an empty fan list',async()=>{backend({'/races/1/support-rating':[]});render(<Supporters raceId={1}/>);expect(await screen.findByText('Поддержки в этом сезоне пока нет.')).toBeVisible();});
it('sends the participant segment once and shows successful and automatic deliveries in history',async()=>{
 const delivered={id:1,segment:'participant:1',message:'Тестовая доставка',fragment:'participant=1',trigger:null,recipients:2,delivered:2,error:null,created_by:'Судья',created_at:'2026-11-03T00:00Z'};const {writes}=backend({'/admin/push':[delivered,{...delivered,id:2,created_by:null,trigger:'stage_started',error:'Частичная доставка'}]},()=>delivered);vi.spyOn(window,'confirm').mockReturnValue(true);render(<PushPage raceId={1}/>);await screen.findByText('stage_started');await userEvent.selectOptions(screen.getByLabelText('Получатели'),'1');fireEvent.change(screen.getByLabelText('Сообщение'),{target:{value:'Тестовая доставка'}});fireEvent.change(screen.getByLabelText('Открыть раздел'),{target:{value:'participant=1'}});await click('Отправить push');expect(await screen.findByText('Доставлено: 2 из 2')).toBeVisible();await waitFor(()=>expect(writes).toHaveLength(1));expect(writes[0].body).toEqual({message:'Тестовая доставка',race_participant_id:1,fragment:'participant=1'});
});
