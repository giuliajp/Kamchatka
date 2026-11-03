import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Icon20Info, Icon20Search, Icon20WarningTriangleOutline } from '@vkontakte/icons';
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
function PassForm({row,checkpoints,initialCp=''}:{row:MonitorRow;checkpoints:Monitoring['checkpoints'];initialCp?:string}) {
  const [cpId,setCpId]=useState(initialCp);const pass=row.passes.find(pass=>pass.stage_checkpoint_id===Number(cpId));
  return <><p className="muted">Время отметки вводится по Камчатке · UTC+12.</p><label className="field">Контрольный пункт<select value={cpId} onChange={e=>setCpId(e.target.value)}><option value="">Выберите КП</option>{checkpoints.map(cp=><option key={cp.stage_checkpoint_id} value={cp.stage_checkpoint_id}>{cp.label || cp.name}</option>)}</select></label>
    {cpId&&<SaveForm key={`${cpId}:${pass?.id}`} label={pass?'Исправить отметку':'Добавить отметку'} onSave={data=>save(pass?`/admin/checkpoint-passes/${pass.id}`:'/admin/checkpoint-passes',pass?'PATCH':'POST',{...(!pass?{race_participant_id:row.race_participant_id,stage_checkpoint_id:Number(cpId)}:{}),arrived_at:kamchatkaValue(data,'arrived_at'),departed_at:kamchatkaValue(data,'departed_at'),note:optional(data,'note')})}>
      <Field label="Прибытие · Камчатка" name="arrived_at" type="datetime-local" required defaultValue={kamchatkaInput(pass?.arrived_at ?? null)}/><Field label="Отправление · Камчатка" name="departed_at" type="datetime-local" defaultValue={kamchatkaInput(pass?.departed_at ?? null)}/><Field label="Примечание судьи" name="note" maxLength={2000} defaultValue={pass?.note ?? ''}/>
    </SaveForm>}{pass&&<ConfirmButton question="Удалить ошибочную отметку? Изменение сохранится в журнале." action={()=>save<Pass>(`/admin/checkpoint-passes/${pass.id}`,'DELETE')}>Удалить отметку</ConfirmButton>}
  </>;
}
function AlertForm({alert}:{alert:Alert}) {
  const [resolving,setResolving]=useState(false);
  return <article className="notice danger"><h3>SOS · {alert.full_name || alert.imei}</h3><p>{time(alert.occurred_at)} · {alert.latitude ?? '—'}, {alert.longitude ?? '—'}</p>
    {alert.acknowledged_at?<p>Закрыт {time(alert.acknowledged_at)} · {alert.acknowledged_by} · {alert.note}</p>:<button className="outline" onClick={()=>setResolving(true)}>Урегулировать SOS</button>}
    {resolving&&<AlertResolution alert={alert} onClose={()=>setResolving(false)}/>}
  </article>;
}
function AlertResolution({alert,onClose}:{alert:Alert;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const element=dialog.current!;element.showModal();element.querySelector('textarea')!.focus();return()=>element.close();},[]);
  return <dialog ref={dialog} className="sos-dialog" aria-labelledby={`sos-title-${alert.id}`} onCancel={onClose}><div className="panel-heading"><h2 id={`sos-title-${alert.id}`}>Урегулировать SOS?</h2><button className="close-button" aria-label="Отменить закрытие SOS" onClick={onClose}>×</button></div><p><Status value="sos"/></p><p><strong>{alert.full_name || alert.imei}</strong><br/>Время сигнала: {time(alert.occurred_at)}</p>
    <SaveForm label="Закрыть SOS" onSave={async data=>{await save(`/admin/alerts/${alert.id}/acknowledge`,'POST',{note:string(data,'note')});onClose();}}><label className="field">Причина закрытия SOS<textarea name="note" required minLength={3} maxLength={2000} placeholder="Опишите результат связи и оказанную помощь"/></label><div className="notice warning"><Icon20Info aria-hidden/><span>Закрывайте сигнал после проверки. Причина, автор и время сохранятся в журнале.</span></div><button type="button" onClick={onClose}>Отмена</button></SaveForm>
  </dialog>;
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
  return <section className="monitor-page"><div className="page-title"><h1>Мониторинг оборудования</h1></div><details className="monitor-tools-menu"><summary>Инструменты этапа</summary><div className="monitor-tools"><div className="tabs">{[['monitor','Мониторинг этапа'],['trackers','Трекеры'],['alerts','Журнал SOS']].map(([value,label])=><button key={value} aria-pressed={tab===value} onClick={()=>setTab(value)}>{label}</button>)}</div>{tab==='monitor'&&<label className="stage-select">Этап мониторинга<select value={stage?.id ?? ''} onChange={e=>setStageId(Number(e.target.value))}>{stages.data?.map(s=><option key={s.id} value={s.id}>Этап {s.number} · {s.name}</option>)}</select></label>}</div></details><LoadState resource={stages}/>
    {tab==='trackers'?<Trackers raceId={raceId} stages={stages.data ?? []}/>:tab==='alerts'?<Alerts raceId={raceId}/>:<>{stage?<Monitor key={stage.id} stageId={stage.id}/>:<p>Этапы пока не созданы.</p>}</>}
  </section>;
}
function Alerts({raceId}:{raceId:number}) {
  const alerts=useResource<Alert[]>(`/admin/races/${raceId}/alerts?active=false`);
  return <section className="card"><h2>Сигналы SOS</h2><LoadState resource={alerts}/>{alerts.data?.length===0&&<p>Сигналов нет.</p>}{alerts.data?.map(alert=><AlertForm key={alert.id} alert={alert}/>)}</section>;
}
function Monitor({stageId}:{stageId:number}) {
  const monitor=useResource<Monitoring>(`/admin/stages/${stageId}/monitoring`,30000);
  const [filter,setFilter]=useState('all');const [cp,setCp]=useState('');const [query,setQuery]=useState('');const [selected,setSelected]=useState<number>();const [mode,setMode]=useState<'pass'|'detail'>('pass');
  const action=useAction();const [poll,setPoll]=useState<{summary:string;errors:string[];points_saved:number;devices_seen:number;skipped:boolean}>();
  const data=monitor.data;const row=data?.rows.find(r=>r.race_participant_id===selected);
  const cpId=Number(cp || data?.checkpoints[0]?.stage_checkpoint_id);
  const passAt=(r:MonitorRow)=>r.passes.find(p=>p.stage_checkpoint_id===cpId);
  const rows=data?.rows.filter(r=>(filter==='all'||(filter==='confirmed'?Boolean(passAt(r)):rowState(r)===filter))&&`${r.start_number} ${r.full_name} ${r.tracker?.imei ?? ''}`.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru')));
  const editRow=row ?? data?.rows[0];
  const openRow=(id:number,view:'pass'|'detail')=>{setSelected(id);setMode(view);};
  return <><div className="monitor-refresh"><button className="primary" aria-label="Запросить данные трекеров" disabled={action.busy} onClick={()=>void action.run(async()=>{setPoll(await save('/admin/trackers/poll','POST'));})}>Обновить данные</button></div><Failure error={action.error}/>{poll&&<div className="notice" role="status"><p>{poll.summary}</p><p>Устройств: {poll.devices_seen}. Сохранено точек: {poll.points_saved}. {poll.skipped?'Опрос пропущен.':''}</p>{poll.errors.map((error,i)=><p key={i}>{error}</p>)}</div>}<LoadState resource={monitor}/>
    {data&&<>{data.summary.sos>0&&<section className="sos-banner" aria-label="Активные сигналы SOS"><Icon20WarningTriangleOutline aria-hidden/><div><strong>Активный SOS · {data.summary.sos}</strong><p>Проверьте связь с участником и откройте карточку сигнала.</p><button onClick={()=>setFilter('sos')}>Показать SOS</button></div></section>}
      <div className="monitor-grid"><div className="monitor-register"><section className="card"><div className="panel-heading"><h2>Устройства на этапе</h2><button className="link-button updated" aria-label="Обновить мониторинг" onClick={monitor.refresh}>Обновлено {time(data.generated_at,true)}</button></div>
        <div className="tabs monitor-filters">{[['all','Все',data.summary.total],['sos','SOS',data.summary.sos],['overdue','Просрочка',data.summary.overdue],['confirmed','Подтверждено судьёй',data.rows.filter(r=>passAt(r)).length],['no_tracker','Без трекера',data.summary.no_tracker],['ok','На связи',data.summary.ok]].map(([value,label,count])=><button key={value} aria-label={String(label)} aria-pressed={filter===value} onClick={()=>setFilter(String(value))}>{label} <span>· {count}</span></button>)}</div>
        <div className="tabs checkpoint-tabs" aria-label="Отметка на КП">{data.checkpoints.map(c=><button key={c.stage_checkpoint_id} aria-pressed={cpId===c.stage_checkpoint_id} onClick={()=>setCp(String(c.stage_checkpoint_id))}>{c.label || c.name}</button>)}</div>
        <label className="field monitor-search">Поиск<span><Icon20Search aria-hidden/><input aria-label="Поиск участника" type="search" placeholder="IMEI, номер или имя участника" value={query} onChange={e=>setQuery(e.target.value)}/></span></label>
        <div className="notice warning"><Icon20Info aria-hidden/><span>Этап {data.stage.number}: интервал {data.tracking_interval_minutes} мин, просрочка после {data.stale_after_minutes} мин. Потеря связи не меняет официальный статус участника.</span></div>
        <Table label="Мониторинг участников"><thead><tr><th>SOS</th><th>Участник</th><th>Трекер</th><th>Судейская отметка</th><th>Приоритет</th><th>Официальное</th><th>Действие</th></tr></thead><tbody>{rows?.map(r=>{const pass=passAt(r);return <tr key={r.race_participant_id} data-state={rowState(r)}><td>{r.active_alerts.length>0?<Icon20WarningTriangleOutline aria-label="Активный SOS"/>:<span className="muted">—</span>}</td><th><button className="participant-link" onClick={()=>openRow(r.race_participant_id,'detail')}>№{r.start_number} · {r.full_name}</button><small>{r.tracker?`IMEI: ${r.tracker.imei}`:'Трекер не назначен'}</small></th><td title={time(r.last_position?.position_at ?? null)}>{time(r.last_position?.position_at ?? null,true)}<small>{r.minutes_since_last===null?'Нет данных':`${r.minutes_since_last} мин назад`}{r.last_position?.battery_percent!=null&&` · ${r.last_position.battery_percent}%`}</small>{rowState(r)!=='ok'&&<Status value={rowState(r)}/>}</td><td className={pass?'success':undefined} title={pass?time(pass.arrived_at):undefined}>{pass?<>✓ {time(pass.arrived_at,true)}<small>Отправление: {time(pass.departed_at,true)}</small></>:'—'}</td><td className={pass?'success':undefined}>{pass?'Судья':'Нет отметки'}</td><td className={pass?'success':undefined}>{pass?`✓ ${time(pass.arrived_at,true)}`:'—'}</td><td><button className="outline" onClick={()=>openRow(r.race_participant_id,'pass')}>{pass?'Изменить':'Внести'}</button></td></tr>;})}</tbody></Table>{rows?.length===0&&<p className="empty">Участников по этим фильтрам нет.</p>}<p className="table-caption">Показано {rows?.length} из {data.summary.total} · просрочено {data.summary.overdue}</p>
      </section><section className="card operating-rules"><h2>Операционные правила</h2><p>Трекер не является источником официального времени. Прохождение КП подтверждает судейская отметка. При её отсутствии официальное время не заполняется. Сбой устройства не снимает участника с гонки.</p></section></div>
      <aside className={`monitor-detail ${mode==='pass'?'quick-entry':''}`} aria-label={mode==='pass'?'Ввод судейской отметки':'Карточка участника'}><section className="card">{mode==='detail'&&row?<><div className="panel-heading"><h2>№{row.start_number} · {row.full_name}</h2><button className="close-button" aria-label="Закрыть карточку" onClick={()=>{setSelected(undefined);setMode('pass');}}>×</button></div><div className="actions"><Status value={row.status}/><Status value={rowState(row)}/></div><p className="muted">{row.tracker?`IMEI: ${row.tracker.imei}`:'Не назначен'}</p>
        {row.last_position?<><PositionMap point={row.last_position}/><p className="coordinates">{row.last_position.latitude}, {row.last_position.longitude}<small>{time(row.last_position.position_at)}</small></p><p>Батарея: {row.last_position.battery_percent ?? '—'}%</p><p className="muted">История батареи пока недоступна.</p></>:<p>Нет точек с начала этапа</p>}{row.active_alerts.map(alert=><AlertForm key={alert.id} alert={alert}/>)}
        <h3>Судейские отметки</h3><PassForm key={row.race_participant_id} row={row} checkpoints={data.checkpoints}/>
      </>:<><h2>Быстрый ввод отметки</h2><label className="field">Участник для отметки<select value={editRow?.race_participant_id ?? ''} onChange={e=>setSelected(Number(e.target.value))}>{data.rows.map(r=><option key={r.race_participant_id} value={r.race_participant_id}>№{r.start_number} · {r.full_name}</option>)}</select></label>{editRow?<PassForm key={`${editRow.race_participant_id}:${cpId}`} row={editRow} checkpoints={data.checkpoints} initialCp={Number.isFinite(cpId)?String(cpId):''}/>:<p className="empty">Участников пока нет.</p>}<div className="notice warning"><Icon20Info aria-hidden/><span>Изменение отметки сохраняется в журнале вместе с автором и временем.</span></div><p className="muted">Вложения и черновики отметок пока недоступны.</p></>}
      </section></aside></div><ChangeLog path={`/admin/stages/${stageId}/checkpoint-passes/log`}/>
    </>}
  </>;
}
