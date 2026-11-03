import {fireEvent,render,screen,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import {MonitoringPage} from '../src/pages/Monitoring';
import {monitoring} from '../src/stories/fixtures';
import {backend} from './backend';
afterEach(()=>vi.unstubAllGlobals());
it('offers quick checkpoint entry and keeps unconfirmed participants visible for the selected checkpoint',async()=>{
 backend();render(<MonitoringPage raceId={1}/>);
 expect(await screen.findByRole('heading',{name:'Быстрый ввод отметки'})).toBeVisible();
 await userEvent.click(screen.getByRole('button',{name:monitoring.checkpoints[0].label!}));
 const table=screen.getByRole('region',{name:'Мониторинг участников'});
 expect(within(table).getByRole('columnheader',{name:'Судейская отметка'})).toBeVisible();
 expect(within(table).getByRole('columnheader',{name:'Официальное'})).toBeVisible();
 expect(within(table).getByRole('button',{name:'№22 · Примеров Иван'})).toBeVisible();
 await userEvent.type(screen.getByLabelText('Поиск участника'),monitoring.rows[0].tracker!.imei);
 expect(within(table).getByRole('button',{name:'№14 · Тестова Алиса'})).toBeVisible();
 expect(within(table).queryByRole('button',{name:'№22 · Примеров Иван'})).not.toBeInTheDocument();
 await userEvent.click(within(table).getByRole('button',{name:'Изменить'}));
 expect(screen.getByLabelText('Прибытие · Камчатка')).toHaveValue('2026-11-03T12:00');
});
it('does not offer an invalid pass when the stage has no checkpoints',async()=>{
 backend({'/admin/stages/1/monitoring':{...monitoring,checkpoints:[]}});render(<MonitoringPage raceId={1}/>);await screen.findByRole('heading',{name:'Быстрый ввод отметки'});expect(screen.queryByLabelText('Прибытие · Камчатка')).not.toBeInTheDocument();
});

it('filters confirmed passes, changes the quick-entry participant and opens an unconfirmed row',async()=>{
 backend();render(<MonitoringPage raceId={1}/>);await userEvent.click(await screen.findByRole('button',{name:'Подтверждено судьёй'}));expect(screen.queryByRole('button',{name:'№22 · Примеров Иван'})).not.toBeInTheDocument();await userEvent.click(screen.getByRole('button',{name:'Все'}));await userEvent.selectOptions(screen.getByLabelText('Участник для отметки'),'2');expect(screen.getByLabelText('Прибытие · Камчатка')).toHaveValue('');await userEvent.click(screen.getAllByRole('button',{name:'Внести'})[1]);expect(screen.getByLabelText('Участник для отметки')).toHaveValue('3');
});
it('keeps a failed SOS resolution for correction and allows cancellation without sending',async()=>{
 const alert={id:2,race_participant_id:1,start_number:14,full_name:null,imei:'123456789012345',type:'sos',occurred_at:'2026-11-03T00:00Z',latitude:null,longitude:null,acknowledged_at:null,acknowledged_by:null,note:null};
 const data={...monitoring,summary:{...monitoring.summary,sos:1},rows:monitoring.rows.map((r,i)=>i===0?{...r,active_alerts:[alert]}:r)};
 const {writes}=backend({'/admin/stages/1/monitoring':data},()=>new Response(JSON.stringify({data:null,error:{message:'Сигнал изменился',code:'conflict',details:null}}),{status:409}));render(<MonitoringPage raceId={1}/>);await userEvent.click(await screen.findByRole('button',{name:'Показать SOS'}));expect(screen.queryByRole('button',{name:'№22 · Примеров Иван'})).not.toBeInTheDocument();await userEvent.click(screen.getByRole('button',{name:'№14 · Тестова Алиса'}));await userEvent.click(screen.getByRole('button',{name:'Урегулировать SOS'}));await userEvent.click(screen.getByRole('button',{name:'Отменить закрытие SOS'}));expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(writes).toHaveLength(0);
 await userEvent.click(screen.getByRole('button',{name:'Урегулировать SOS'}));await userEvent.type(screen.getByLabelText('Причина закрытия SOS'),'Связались с участником');await userEvent.click(screen.getByRole('button',{name:'Закрыть SOS'}));expect(await screen.findByRole('alert')).toHaveTextContent('Сигнал изменился');expect(screen.getByLabelText('Причина закрытия SOS')).toHaveValue('Связались с участником');await userEvent.click(screen.getByRole('button',{name:'Отмена'}));await userEvent.click(screen.getByRole('button',{name:'Урегулировать SOS'}));fireEvent(screen.getByRole('dialog'),new Event('cancel'));expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(writes).toHaveLength(1);
});
