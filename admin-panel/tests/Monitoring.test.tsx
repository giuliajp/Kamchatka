import {render,screen,fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import {MonitoringPage} from '../src/pages/Monitoring';
afterEach(()=>vi.unstubAllGlobals());
it('shows real SOS and stale telemetry, and requires a reason to close an alert',async()=>{
 const alert={id:2,race_participant_id:9,start_number:14,full_name:'Каюр',imei:'123',type:'sos',occurred_at:'2026-11-03T00:00Z',latitude:53,longitude:158,acknowledged_at:null,acknowledged_by:null,note:null};
 const fetcher=vi.fn(async(url:string,init?:RequestInit)=>new Response(JSON.stringify({data:url.endsWith('/stages')?[{id:3,number:1,name:'Этап',status:'live'}]:url.endsWith('/monitoring')?{stage:{id:3,number:1,name:'Этап',status:'live'},race_id:10,generated_at:'2026-11-03T00:00Z',tracking_interval_minutes:20,stale_after_minutes:45,checkpoints:[],summary:{total:1,sos:1,overdue:1,no_tracker:0,ok:0},rows:[{race_participant_id:9,start_number:14,full_name:'Каюр',discipline:{id:1,code:'sled',name:'Нарта'},status:'active',tracker:{imei:'123',name:null},last_position:null,minutes_since_last:90,is_overdue:true,active_alerts:[alert],passes:[]}]}:url.includes('/acknowledge')?{...alert,acknowledged_at:'2026-11-03T01:00Z',acknowledged_by:'Судья',note:JSON.parse(init!.body as string).note}:url.includes('/alerts')?[alert]:[],error:null})));
 vi.stubGlobal('fetch',fetcher);render(<MonitoringPage raceId={10}/>);
 expect(await screen.findByRole('button',{name:'№14 · Каюр'})).toBeVisible();
 await userEvent.click(screen.getByRole('button',{name:'№14 · Каюр'}));
 expect(screen.getByText('Нет точек с начала этапа')).toBeVisible();
 const reason=await screen.findByLabelText('Причина закрытия SOS');expect(reason).toBeRequired();fireEvent.change(reason,{target:{value:'Связались, помощь оказана'}});
 await userEvent.click(screen.getByRole('button',{name:'Закрыть SOS'}));
 expect(fetcher).toHaveBeenCalledWith('/api/admin/alerts/2/acknowledge',expect.objectContaining({method:'POST',body:JSON.stringify({note:'Связались, помощь оказана'})}));
});
