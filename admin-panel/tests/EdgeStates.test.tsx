import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import {api,useResource} from '../src/api';
import {Field,LoadState,SaveForm,Status,string} from '../src/ui';
import {RaceSetup} from '../src/pages/RaceSetup';
import {Results,CsvImport} from '../src/pages/Results';
import {Participants} from '../src/pages/Participants';
import {MonitoringPage} from '../src/pages/Monitoring';
import {fixtureData,race,stage,entry,monitoring,protocol} from '../src/stories/fixtures';
import {backend} from './backend';
vi.mock('leaflet',()=>({default:{map:vi.fn(()=>({setView:vi.fn().mockReturnThis(),remove:vi.fn()})),tileLayer:vi.fn(()=>({addTo:vi.fn()})),circleMarker:vi.fn(()=>({addTo:vi.fn()}))}}));
afterEach(()=>vi.unstubAllGlobals());
const click=(name:string)=>userEvent.click(screen.getByRole('button',{name}));
it('surfaces unexpected transport errors, generic HTTP errors, and unknown status values',async()=>{
 const {fetcher}=backend();fetcher.mockResolvedValueOnce(new Response('{}',{status:503}));await expect(api('/admin/me')).rejects.toThrow('Ошибка 503');fetcher.mockRejectedValueOnce('offline');function Probe(){const r=useResource('/admin/me');return <LoadState resource={r}/>;}render(<><Probe/><Status value="new-server-status"/></>);expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось связаться с сервером');expect(screen.getByText('new-server-status')).toBeVisible();expect(string(new FormData(),'missing')).toBe('');
});
it('does not submit a destructive form when its confirmation is cancelled',async()=>{const onSave=vi.fn();vi.spyOn(window,'confirm').mockReturnValue(false);render(<SaveForm confirm="Удалить?" onSave={onSave}><Field label="Причина" name="reason"/></SaveForm>);await click('Сохранить');expect(onSave).not.toHaveBeenCalled();});
it('shows unconfigured route and unlabeled checkpoint defaults and active bounded disciplines',async()=>{
 const links=fixtureData('/admin/stages/1/checkpoints') as Record<string,unknown>[];backend({'/admin/races/1/stages':[{...stage,route_source_filename:null,route_updated_at:null,route_length_km:null}],'/admin/stages/1/checkpoints':[{...links[0],label:null,km_from_start:null}]});render(<RaceSetup race={race}/>);await screen.findByRole('option',{name:/Этап 1/});await userEvent.selectOptions(screen.getByLabelText('Выбранный этап'),'1');expect(screen.getByText('Файл маршрута не загружен')).toBeVisible();await click('Контрольные пункты');await screen.findByRole('button',{name:/Тестовый КП · 1/});await click('Дисциплины');expect(await screen.findAllByText('Активна')).not.toHaveLength(0);
});
it('renders incomplete registration data without inventing a region or dog count',async()=>{backend({'/admin/races/1/participants':[{...entry,region:null,dogs_count:null}]});render(<Participants raceId={1}/>);await screen.findByRole('button',{name:entry.participant.full_name});expect(screen.getAllByText('—')).toHaveLength(2);});
it('shows skipped tracker polls and allows inspection of participants without a tracker',async()=>{
 const data=structuredClone(monitoring);data.rows[0].last_position={latitude:53,longitude:158,position_at:'2026-11-03T00:00Z',battery_percent:null};const {writes}=backend({'/admin/stages/1/monitoring':data},()=>({summary:'Уже идёт опрос',errors:[],points_saved:0,devices_seen:0,skipped:true}));render(<MonitoringPage raceId={1}/>);await userEvent.click(await screen.findByRole('button',{name:'№14 · Тестова Алиса'}));expect(screen.getByText('Батарея: —%')).toBeVisible();await click('Закрыть карточку');await click('№22 · Примеров Иван');expect(screen.getByText('Не назначен')).toBeVisible();await click('Запросить данные трекеров');expect(await screen.findByText(/Опрос пропущен/)).toBeVisible();expect(writes).toHaveLength(1);
});
it('shows non-finishers and optional protocol metadata without fabricating duration or dogs',async()=>{
 const detail={...protocol,status:'preliminary',weather:'Снег',chief_judge:'Судья',chief_secretary:'Секретарь',results:[{...protocol.results[0],status:'dnf',place:null,region:null,time:null,dogs_at_start:null,dogs_at_finish:null,note:'Сход',is_corrected_after_final:false}]};backend({'/admin/protocols/2':detail,'/admin/races/1/protocols':[detail]});render(<Results raceId={1}/>);await userEvent.click(await screen.findByRole('button',{name:/Этап 1 · Нарта/}));await click('№14 · Тестова Алиса');expect(screen.getByLabelText('Время ЧЧ:ММ:СС')).toHaveValue('');expect(screen.getByLabelText('Собаки на финише')).toHaveValue(null);expect(screen.getByLabelText('Примечание')).toHaveValue('Сход');expect(screen.getByLabelText('Погода')).toHaveValue('Снег');
});
it('shows CSV warnings for organizer review before the separate upload step',async()=>{
 backend({},()=>({rows:1,participants_created:0,results_created:1,results_updated:0,results_unchanged:0,penalties_changed:0,protocols_created:1,warnings:['Строка 2: регион не указан'],saved:false}));render(<CsvImport raceId={1}/>);await userEvent.upload(screen.getByLabelText('CSV из Excel'),new File(['test'],'test.csv',{type:'text/csv'}));await click('Проверить');expect(await screen.findByText('Строка 2: регион не указан')).toBeVisible();expect(screen.getByRole('button',{name:'Загрузить'})).toBeEnabled();fireEvent.change(screen.getByLabelText('CSV из Excel'),{target:{files:[]}});await waitFor(()=>expect(screen.getByRole('button',{name:'Загрузить'})).toBeDisabled());
});
