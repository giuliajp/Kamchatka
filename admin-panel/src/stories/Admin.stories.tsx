import { useState } from 'react';
import { userEvent, within } from 'storybook/test';
import { MonitoringPresentationContext, type SosDecision } from '../monitoringPresentation';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { App } from '../App';
import contentCaptures from '../../../frontend/src/stories/design-api-fixtures.json';
import { Content } from '../pages/Content';
import { Participants } from '../pages/Participants';
import { PushPage } from '../pages/Push';
import { RaceSetup } from '../pages/RaceSetup';
import { Results } from '../pages/Results';
import { Supporters } from '../pages/Supporters';
import { Field, SaveForm, Status, Table } from '../ui';
import { installApi, monitoring, race } from './fixtures';
function signedApi(override?:Parameters<typeof installApi>[0]){history.replaceState(null,'','#section=monitoring&race=1&stage=1');sessionStorage.setItem('avacha:admin-token','storybook-session');const restore=installApi(override);return()=>{restore();sessionStorage.removeItem('avacha:admin-token');};}
const meta={title:'Админка/Экраны',beforeEach:()=>installApi(),parameters:{layout:'fullscreen',docs:{story:{inline:false}}}} satisfies Meta;
export default meta;
type Story=StoryObj<typeof meta>;
export const Navigation:Story={beforeEach:()=>signedApi(),render:()=> <App/>};
export const Login:Story={beforeEach:()=>{sessionStorage.removeItem('avacha:admin-token');return installApi();},render:()=> <App/>};
export const MonitoringNormal:Story={beforeEach:()=>signedApi(),render:()=> <App/>};
export const MonitoringOverdue:Story={beforeEach:()=>signedApi(path=>path.endsWith('/monitoring')?{...monitoring,summary:{total:3,ok:0,overdue:1,sos:0,no_tracker:2},rows:monitoring.rows.map((row,index)=>index===0?{...row,is_overdue:true,minutes_since_last:90,last_position:{latitude:53.2,longitude:158.5,position_at:'2026-11-03T00:00Z',battery_percent:15}}:row)}:undefined),render:()=> <App/>};
const sosMonitoring={...monitoring,summary:{total:3,ok:0,overdue:0,sos:1,no_tracker:2},rows:monitoring.rows.map((row,index)=>index===0?{...row,last_position:{latitude:53.2,longitude:158.5,position_at:'2026-11-03T00:00Z',battery_percent:34},active_alerts:[{id:1,race_participant_id:row.race_participant_id,start_number:row.start_number,full_name:row.full_name,imei:'123456789012345',type:'sos',occurred_at:'2026-11-03T00:00Z',latitude:53.2,longitude:158.5,acknowledged_at:null,acknowledged_by:null,note:null}]}:row)};
export const MonitoringSOS:Story={beforeEach:()=>signedApi(path=>path.endsWith('/monitoring')?sosMonitoring:path.endsWith('/alerts?active=true')?sosMonitoring.rows.flatMap(row=>row.active_alerts):undefined),render:()=> <App/>};
export const MonitoringEmpty:Story={beforeEach:()=>signedApi(path=>path.endsWith('/monitoring')?{...monitoring,rows:[],summary:{total:0,ok:0,overdue:0,sos:0,no_tracker:0}}:undefined),render:()=> <App/>};
export const RaceSettings:Story={render:()=> <RaceSetup race={race}/>};
export const Entries:Story={render:()=> <Participants raceId={1}/>};
export const Protocols:Story={render:()=> <Results raceId={1}/>};
export const PushMessages:Story={render:()=> <PushPage raceId={1}/>};
export const Fans:Story={render:()=> <Supporters raceId={1}/>};
export const PublishedContent:Story={beforeEach:()=>installApi(path=>(contentCaptures as Record<string,unknown>)[path]),render:()=> <Content raceId={1}/>};
export const FieldsAndStates:Story={render:()=> <section className="card"><h1>Поля и состояния</h1><SaveForm onSave={async()=>undefined}><Field label="Название" name="name" required placeholder="Название этапа"/><Field label="Время по Камчатке" name="date" type="datetime-local"/><Field label="Количество" name="count" type="number"/><Field label="Активен" name="active" type="checkbox"/><label className="field">Комментарий<textarea name="note"/></label></SaveForm><div className="tabs"><button aria-pressed>Все</button><button aria-pressed={false}>Мои</button></div><div className="actions">{['planned','live','finished','draft','preliminary','final','sos','overdue','no_tracker','dnf'].map(value=><Status key={value} value={value}/>)}</div><Table label="Пример таблицы"><thead><tr><th>Участник</th><th>Статус</th><th>Батарея</th></tr></thead><tbody><tr data-state="overdue"><th>№14 · Тестова Алиса</th><td><Status value="overdue"/></td><td>15%</td></tr></tbody></Table></section>};

let decisions:Record<number,SosDecision>={};
function acceptanceApi(){decisions={};return signedApi(path=>path.endsWith('/monitoring')?{...sosMonitoring,summary:{...sosMonitoring.summary,sos:decisions[1]?0:1},rows:sosMonitoring.rows.map(row=>({...row,active_alerts:row.active_alerts.filter(alert=>!decisions[alert.id])}))}:path.endsWith('/alerts?active=true')?sosMonitoring.rows.flatMap(row=>row.active_alerts).filter(alert=>!decisions[alert.id]):undefined);}
function AcceptanceWorkspace(){
 const [feedback,setFeedback]=useState('');
 return <MonitoringPresentationContext.Provider value={{resolveSos:async(id,decision)=>{decisions[id]=decision;setFeedback(decision.outcome==='resolved'?'SOS урегулирован':'Сигнал отмечен как ложный');window.dispatchEvent(new Event('admin:changed'));},checkpointEvidence:{initial:{checkpointId:monitoring.checkpoints[0].stage_checkpoint_id,arrivedAt:'14:58',source:'Судейский протокол',attachmentName:'Протокол КП-2.jpg',note:'Связались по спутниковому телефону. Каюр в безопасности.'},onDraft:()=>setFeedback('Черновик сохранён на стенде'),onConfirm:async()=>setFeedback('Отметка подтверждена на стенде')},battery:{1:[{label:'10:00',percent:74},{label:'11:00',percent:67},{label:'12:00',percent:56},{label:'13:00',percent:42},{label:'13:41',percent:34}]},history:[{id:'1',time:'13:42',author:'Оператор гонки',description:'Получен сигнал SOS от участника №14.'},{id:'2',time:'13:45',author:'Судья КП-2',description:'Связь с участником установлена.'}]}}><App/>{feedback&&<div className="fixture-feedback" role="status">{feedback}</div>}</MonitoringPresentationContext.Provider>;
}
export const AcceptanceNormal:Story={beforeEach:()=>signedApi(),render:()=> <AcceptanceWorkspace/>};
export const AcceptanceSOS:Story={beforeEach:acceptanceApi,render:()=> <AcceptanceWorkspace/>};
export const AcceptanceSOSFilter:Story={...AcceptanceSOS,play:async({canvasElement})=>{const canvas=within(canvasElement);await userEvent.click(await canvas.findByRole('button',{name:'Показать SOS'}));}};
export const AcceptanceSOSDecision:Story={...AcceptanceSOS,play:async({canvasElement})=>{const canvas=within(canvasElement);await userEvent.click(await canvas.findByRole('button',{name:'№14 · Тестова Алиса'}));await userEvent.click(await canvas.findByRole('button',{name:'Урегулировать SOS'}));await userEvent.type(canvas.getByLabelText('Причина закрытия SOS'),'Связались по спутниковому телефону. Каюр в безопасности, помощь оказана на КП 2.');}};
export const AcceptanceBatteryHistory:Story={...AcceptanceSOS,play:async({canvasElement})=>{await userEvent.click(await within(canvasElement).findByRole('button',{name:'№14 · Тестова Алиса'}));}};
