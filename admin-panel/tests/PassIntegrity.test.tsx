import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it, vi} from 'vitest';
import {MonitoringPage} from '../src/pages/Monitoring';
import {monitoring} from '../src/stories/fixtures';
import {backend} from './backend';
import {kamchatkaInput, kamchatkaValue} from '../src/ui';

afterEach(()=>vi.unstubAllGlobals());
it('keeps seconds in the editor and original fractional precision when unchanged',()=>{
 const original='2026-11-03T00:01:23.123456Z';
 expect(kamchatkaInput(original)).toBe('2026-11-03T12:01:23');
 const data=new FormData();data.set('at',kamchatkaInput(original));
 // The original value is passed by every form that edits an existing timestamp.
 expect(kamchatkaValue(data,'at',original)).toBe(original);
 data.set('at','2026-11-03T12:02:35');expect(kamchatkaValue(data,'at',original)).toBe('2026-11-03T12:02:35+12:00');
 data.set('at','');expect(kamchatkaValue(data,'at',original)).toBeNull();
});
it('preserves a draft through polling, sends only edited fields, and requires explicit conflict reapplication',async()=>{
 const data=structuredClone(monitoring);
 const pass=data.rows[0].passes[0];pass.arrived_at='2026-11-03T00:01:23.123456Z';pass.note='original';
 const original={...pass};
 const overrides={'/admin/stages/1/monitoring':data};
 const {writes}=backend(overrides,(_path,_method,body)=>{
  const patch=body as Partial<typeof pass>&{expected_updated_at:string};
  if(patch.expected_updated_at!==pass.updated_at)return new Response(JSON.stringify({data:null,error:{code:'conflict',message:'Отметка изменена',details:{current:pass}}}),{status:409});
  Object.assign(pass,patch,{updated_at:'2026-11-04T01:00:00Z'});return pass;
 });
 render(<MonitoringPage raceId={1}/>);
 const arrival=await screen.findByLabelText('Прибытие · Камчатка');
 expect((arrival as HTMLInputElement).value).toMatch(/^2026-11-03T12:01:23(?:\.000)?$/);expect(arrival).toHaveAttribute('step','1');
 fireEvent.change(screen.getByLabelText('Примечание судьи'),{target:{value:'my draft'}});
 pass.departed_at='2026-11-03T00:30:45.654321Z';pass.note='other judge';pass.updated_at='2026-11-03T23:00:00Z';
 act(()=>window.dispatchEvent(new Event('admin:changed')));
 await userEvent.click(screen.getByRole('button',{name:'Исправить отметку'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Отметка изменена');
 expect(writes[0]).toEqual({path:`/admin/checkpoint-passes/${pass.id}`,method:'PATCH',body:{expected_updated_at:original.updated_at,note:'my draft'}});
 expect(screen.getByLabelText('Примечание судьи')).toHaveValue('my draft');
 expect(screen.getByRole('region',{name:'Актуальная отметка'})).toHaveTextContent('other judge');
 expect(screen.getByRole('button',{name:'Исправить отметку'})).toBeDisabled();
 await userEvent.click(screen.getByRole('button',{name:'Применить мой черновик к новой версии'}));
 await userEvent.click(screen.getByRole('button',{name:'Исправить отметку'}));
 await waitFor(()=>expect(writes).toHaveLength(2));
 expect(writes[1].body).toEqual({expected_updated_at:'2026-11-03T23:00:00Z',note:'my draft'});
 expect(pass.arrived_at).toBe(original.arrived_at);expect(pass.departed_at).toBe('2026-11-03T00:30:45.654321Z');
});
it('can discard the draft and accept the current values without writing them back',async()=>{
 const original=monitoring.rows[0].passes[0];
 const current={...original,arrived_at:'2026-11-03T01:02:35.123456Z',departed_at:null,note:null,updated_at:'2026-11-04T01:00Z'};
 const {writes}=backend({},()=>new Response(JSON.stringify({data:null,error:{code:'conflict',message:'Изменено',details:{current}}}),{status:409}));
 render(<MonitoringPage raceId={1}/>);await screen.findByLabelText('Прибытие · Камчатка');
 fireEvent.change(screen.getByLabelText('Прибытие · Камчатка'),{target:{value:'2026-11-03T13:03:45'}});
 await userEvent.click(screen.getByRole('button',{name:'Исправить отметку'}));
 await userEvent.click(await screen.findByRole('button',{name:'Принять актуальные значения'}));
 expect((screen.getByLabelText('Прибытие · Камчатка') as HTMLInputElement).value).toMatch(/^2026-11-03T13:02:35(?:\.000)?$/);
 expect(screen.getByLabelText('Отправление · Камчатка')).toHaveValue('');expect(screen.getByLabelText('Примечание судьи')).toHaveValue('');
 expect(writes).toHaveLength(1);expect(writes[0].body).toEqual({expected_updated_at:original.updated_at,arrived_at:'2026-11-03T13:03:45.000+12:00'});
});
it.each([null,{current:{id:1}}])('does not rebase a draft from an invalid conflict response: %j',async details=>{
 const {writes}=backend({},()=>new Response(JSON.stringify({data:null,error:{code:'conflict',message:'Повторите загрузку',details}}),{status:409}));
 render(<MonitoringPage raceId={1}/>);await screen.findByLabelText('Примечание судьи');
 fireEvent.change(screen.getByLabelText('Примечание судьи'),{target:{value:'keep me'}});
 await userEvent.click(screen.getByRole('button',{name:'Исправить отметку'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Повторите загрузку');
 expect(screen.getByLabelText('Примечание судьи')).toHaveValue('keep me');expect(writes).toHaveLength(1);
 expect(screen.queryByRole('button',{name:'Применить мой черновик к новой версии'})).not.toBeInTheDocument();
});
it('retains the draft after a transport failure',async()=>{
 backend({},()=>{throw new Error('Offline');});render(<MonitoringPage raceId={1}/>);
 await screen.findByLabelText('Примечание судьи');fireEvent.change(screen.getByLabelText('Примечание судьи'),{target:{value:'offline draft'}});
 await userEvent.click(screen.getByRole('button',{name:'Исправить отметку'}));expect(await screen.findByRole('alert')).toHaveTextContent('Offline');
 expect(screen.getByLabelText('Примечание судьи')).toHaveValue('offline draft');
});
