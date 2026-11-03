import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { save, useAction, useResource } from '../api';
import type { Alert, Entry, MonitorRow, Monitoring, Pass, Stage, Tracker } from '../types';
import { ConfirmButton, Failure, Field, LoadState, SaveForm, Status, Table, kamchatkaInput, kamchatkaValue, numeric, optional, string, time } from '../ui';
import { ChangeLog } from './Results';
export const rowState=(row:MonitorRow)=>row.active_alerts.length?'sos':!row.tracker?'no_tracker':row.is_overdue?'overdue':'ok';
export function PositionMap({point}:{point:NonNullable<MonitorRow['last_position']>}) {
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const map=L.map(root.current!).setView([point.latitude,point.longitude],12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(map);
    L.circleMarker([point.latitude,point.longitude],{radius:8,color:'#1b578f'}).addTo(map);
    return ()=>{map.remove();};
  },[point.latitude,point.longitude]);
  return <div className="map-panel" ref={root} aria-label="Последняя точка трекера"/>;
}
function PassForm({row,checkpoints}:{row:MonitorRow;checkpoints:Monitoring['checkpoints']}) {
  const [cpId,setCpId]=useState('');const pass=row.passes.find(pass=>pass.stage_checkpoint_id===Number(cpId));
  return <><h3>Отметка судьи</h3><p className="muted">GPS не является подтверждением прохождения КП.</p><label className="field">Контрольный пункт<select value={cpId} onChange={e=>setCpId(e.target.value)}><option value="">Выберите КП</option>{checkpoints.map(cp=><option key={cp.stage_checkpoint_id} value={cp.stage_checkpoint_id}>{cp.label || cp.name}</option>)}</select></label>
    {cpId&&<SaveForm key={`${cpId}:${pass?.id}`} label={pass?'Исправить отметку':'Добавить отметку'} onSave={data=>save(pass?`/admin/checkpoint-passes/${pass.id}`:'/admin/checkpoint-passes',pass?'PATCH':'POST',{...(!pass?{race_participant_id:row.race_participant_id,stage_checkpoint_id:Number(cpId)}:{}),arrived_at:kamchatkaValue(data,'arrived_at'),departed_at:kamchatkaValue(data,'departed_at'),note:optional(data,'note')})}>
      <Field label="Прибытие · Камчатка" name="arrived_at" type="datetime-local" required defaultValue={kamchatkaInput(pass?.arrived_at ?? null)}/><Field label="Отправление · Камчатка" name="departed_at" type="datetime-local" defaultValue={kamchatkaInput(pass?.departed_at ?? null)}/><Field label="Примечание судьи" name="note" maxLength={2000} defaultValue={pass?.note ?? ''}/>
    </SaveForm>}{pass&&<ConfirmButton question="Удалить ошибочную отметку? Изменение сохранится в журнале." action={()=>save<Pass>(`/admin/checkpoint-passes/${pass.id}`,'DELETE')}>Удалить отметку</ConfirmButton>}
  </>;
}
function AlertForm({alert}:{alert:Alert}) {
  return <article className="notice danger"><h3>SOS · {alert.full_name || alert.imei}</h3><p>{time(alert.occurred_at)} · {alert.latitude ?? '—'}, {alert.longitude ?? '—'}</p>
    {alert.acknowledged_at?<p>Закрыт {time(alert.acknowledged_at)} · {alert.acknowledged_by} · {alert.note}</p>:<SaveForm label="Закрыть SOS" onSave={data=>save(`/admin/alerts/${alert.id}/acknowledge`,'POST',{note:string(data,'note')})}><Field label="Причина закрытия SOS" name="note" required minLength={3} maxLength={2000}/></SaveForm>}
  </article>;
}
function Trackers({raceId,stages}:{raceId:number;stages:Stage[]}) {
  const trackers=useResource<Tracker[]>('/admin/trackers');const entries=useResource<Entry[]>(`/admin/races/${raceId}/participants`);const [id,setId]=useState<number>();const tracker=trackers.data?.find(t=>t.id===id);
  return <div className="grid"><section className="card"><h2>Оборудование</h2><LoadState resource={trackers}/><Table label="Трекеры"><thead><tr><th>IMEI</th><th>Название</th><th>Выдан</th><th>Состояние</th></tr></thead><tbody>{trackers.data?.map(t=><tr key={t.id}><td><button onClick={()=>setId(t.id)}>{t.imei}</button></td><td>{t.name || '—'}</td><td>{t.assigned_to?`№${t.assigned_to.start_number} ${t.assigned_to.full_name}`:'Свободен'}</td><td>{t.is_active?'Активен':'Выключен'}</td></tr>)}</tbody></Table><button onClick={()=>setId(undefined)}>Новый трекер</button></section>
    <section className="card"><h2>{tracker?tracker.imei:'Новый трекер'}</h2><SaveForm key={id ?? 'new'} onSave={data=>save(tracker?`/admin/trackers/${tracker.id}`:'/admin/trackers',tracker?'PATCH':'POST',{name:optional(data,'name'),...(tracker?{is_active:data.has('is_active')}:{imei:string(data,'imei')})})}>
      {!tracker&&<Field label="IMEI" name="imei" pattern="[0-9]{15}" required/>}<Field label="Название трекера" name="name" maxLength={100} defaultValue={tracker?.name ?? ''}/>{tracker&&<Field label="Принимать точки с трекера" name="is_active" type="checkbox" defaultChecked={tracker.is_active}/>}</SaveForm>
      {tracker&&<><h3>Назначение участнику</h3><LoadState resource={entries}/>{tracker.assigned_to&&<p>Выдан {tracker.assigned_to.full_name} с {time(tracker.assigned_to.valid_from)}</p>}
        <SaveForm key={`assign:${id}`} label="Выдать трекер" onSave={data=>save(`/admin/trackers/${tracker.id}/assign`,'POST',{race_participant_id:numeric(data,'race_participant_id'),stage_id:numeric(data,'stage_id'),valid_from:kamchatkaValue(data,'valid_from')})}>
          <label className="field">Получатель трекера<select name="race_participant_id" required><option value="">Выберите участника</option>{entries.data?.map(e=><option key={e.id} value={e.id}>№{e.start_number} · {e.participant.full_name}</option>)}</select></label><label className="field">Срок назначения<select name="stage_id"><option value="">На всю гонку</option>{stages.map(s=><option key={s.id} value={s.id}>Этап {s.number}</option>)}</select></label><Field label="Начало назначения · Камчатка" name="valid_from" type="datetime-local"/><small>Пустая дата — выдать сейчас. Предыдущее назначение закроется.</small>
        </SaveForm>{tracker.assigned_to&&<ConfirmButton question="Забрать трекер у участника?" action={()=>save(`/admin/trackers/${tracker.id}/unassign`,'POST')}>Забрать трекер</ConfirmButton>}
      </>}
    </section></div>;
}
export function MonitoringPage({raceId}:{raceId:number}) {
  const stages=useResource<Stage[]>(`/admin/races/${raceId}/stages`);const [stageId,setStageId]=useState<number>();const [tab,setTab]=useState('monitor');
  const stage=stages.data?.find(s=>s.id===stageId) ?? stages.data?.find(s=>s.status==='live') ?? stages.data?.[0];
  return <><div className="tabs">{[['monitor','Мониторинг этапа'],['trackers','Трекеры'],['alerts','Журнал SOS']].map(([value,label])=><button key={value} aria-pressed={tab===value} onClick={()=>setTab(value)}>{label}</button>)}</div><LoadState resource={stages}/>
    {tab==='trackers'?<Trackers raceId={raceId} stages={stages.data ?? []}/>:tab==='alerts'?<Alerts raceId={raceId}/>:<><div className="toolbar"><label className="field">Этап мониторинга<select value={stage?.id ?? ''} onChange={e=>setStageId(Number(e.target.value))}>{stages.data?.map(s=><option key={s.id} value={s.id}>Этап {s.number} · {s.name}</option>)}</select></label></div>{stage?<Monitor key={stage.id} stageId={stage.id}/>:<p>Этапы пока не созданы.</p>}</>}
  </>;
}
function Alerts({raceId}:{raceId:number}) {
  const alerts=useResource<Alert[]>(`/admin/races/${raceId}/alerts?active=false`);
  return <section className="card"><h2>Сигналы SOS</h2><LoadState resource={alerts}/>{alerts.data?.length===0&&<p>Сигналов нет.</p>}{alerts.data?.map(alert=><AlertForm key={alert.id} alert={alert}/>)}</section>;
}
function Monitor({stageId}:{stageId:number}) {
  const monitor=useResource<Monitoring>(`/admin/stages/${stageId}/monitoring`,30000);const [filter,setFilter]=useState('all');const [cp,setCp]=useState('');const [query,setQuery]=useState('');const [selected,setSelected]=useState<number>();
  const action=useAction();const [poll,setPoll]=useState<{summary:string;errors:string[];points_saved:number;devices_seen:number;skipped:boolean}>();
  const data=monitor.data;const row=data?.rows.find(r=>r.race_participant_id===selected);
  const rows=data?.rows.filter(r=>(filter==='all'||rowState(r)===filter)&&(!cp||r.passes.some(p=>p.stage_checkpoint_id===Number(cp)))&&`${r.start_number} ${r.full_name}`.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru')));
  return <><div className="toolbar"><button onClick={monitor.refresh}>Обновить мониторинг</button><button disabled={action.busy} onClick={()=>void action.run(async()=>{setPoll(await save('/admin/trackers/poll','POST'));})}>Запросить данные трекеров</button>{data&&<small>Обновлено {time(data.generated_at)} · просрочка после {data.stale_after_minutes} мин</small>}</div><Failure error={action.error}/>{poll&&<div className="notice" role="status"><p>{poll.summary}</p><p>Устройств: {poll.devices_seen}. Сохранено точек: {poll.points_saved}. {poll.skipped?'Опрос пропущен.':''}</p>{poll.errors.map((error,i)=><p key={i}>{error}</p>)}</div>}<LoadState resource={monitor}/>
    {data&&<><div className="stat-grid">{[['total','Участников'],['sos','SOS'],['overdue','Просрочено'],['no_tracker','Без трекера'],['ok','На связи']].map(([key,label])=><div className="stat" key={key}><small>{label}</small><strong>{data.summary[key as keyof Monitoring['summary']]}</strong></div>)}</div>
      <div className="monitor-grid"><section className="card"><h2>Участники на дистанции</h2><div className="tabs">{[['all','Все'],['sos','SOS'],['overdue','Просрочка'],['no_tracker','Без трекера'],['ok','На связи']].map(([value,label])=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}</div>
        <div className="toolbar"><Field label="Поиск участника" type="search" value={query} onChange={e=>setQuery(e.target.value)}/><label className="field">Отметка на КП<select value={cp} onChange={e=>setCp(e.target.value)}><option value="">Все КП</option>{data.checkpoints.map(c=><option key={c.stage_checkpoint_id} value={c.stage_checkpoint_id}>{c.label || c.name}</option>)}</select></label></div>
        <Table label="Мониторинг участников"><thead><tr><th>Участник</th><th>Связь</th><th>Последняя точка</th><th>Батарея</th>{data.checkpoints.map(c=><th key={c.stage_checkpoint_id}>{c.label || c.name}</th>)}</tr></thead><tbody>{rows?.map(r=><tr key={r.race_participant_id} data-state={rowState(r)}><th><button className="link-button" onClick={()=>setSelected(r.race_participant_id)}>№{r.start_number} · {r.full_name}</button><small>{r.discipline.name}</small></th><td><Status value={rowState(r)}/></td><td>{time(r.last_position?.position_at ?? null)}<small>{r.minutes_since_last===null?'Нет данных':`${r.minutes_since_last} мин назад`}</small></td><td>{r.last_position?.battery_percent===null||!r.last_position?'—':`${r.last_position.battery_percent}%`}</td>{data.checkpoints.map(c=>{const pass=r.passes.find(p=>p.stage_checkpoint_id===c.stage_checkpoint_id);return <td key={c.stage_checkpoint_id}>{pass?<>{time(pass.arrived_at)}<small>Отправление: {time(pass.departed_at)}</small></>:'—'}</td>;})}</tr>)}</tbody></Table>{rows?.length===0&&<p className="empty">Участников по этим фильтрам нет.</p>}
      </section><section className="card">{row?<><div className="actions"><h2>№{row.start_number} · {row.full_name}</h2><button onClick={()=>setSelected(undefined)}>Закрыть карточку</button></div><Status value={rowState(row)}/><dl className="detail-list"><div><dt>Трекер</dt><dd>{row.tracker?.imei || 'Не назначен'}</dd></div><div><dt>Статус в гонке</dt><dd><Status value={row.status}/></dd></div></dl>
        {row.active_alerts.map(alert=><AlertForm key={alert.id} alert={alert}/>)}{row.last_position?<><PositionMap point={row.last_position}/><p>{time(row.last_position.position_at)} · {row.last_position.latitude}, {row.last_position.longitude}</p><p>Батарея: {row.last_position.battery_percent ?? '—'}%</p></>:<p>Нет точек с начала этапа</p>}
        <PassForm key={row.race_participant_id} row={row} checkpoints={data.checkpoints}/>
      </>:<div className="empty"><h2>Карточка участника</h2><p>Выберите участника в таблице для просмотра трекера, SOS и внесения судейских отметок.</p></div>}</section></div><ChangeLog path={`/admin/stages/${stageId}/checkpoint-passes/log`}/>
    </>}
  </>;
}
