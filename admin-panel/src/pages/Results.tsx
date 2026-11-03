import { useRef, useState } from 'react';
import { save, useAction, useResource } from '../api';
import type { Entry, Penalty, Protocol, ProtocolDetail, Result } from '../types';
import { ConfirmButton, Failure, Field, LoadState, SaveForm, Status, Table, numeric, optional, string, time } from '../ui';
interface ImportReport { rows:number; participants_created:number; results_created:number; results_updated:number; results_unchanged:number; penalties_changed:number; protocols_created:number; warnings:string[]; saved:boolean }
export function CsvImport({raceId}:{raceId:number}) {
  const [file,setFile]=useState<File>(); const [report,setReport]=useState<ImportReport>();const action=useAction();const version=useRef(0);
  const submit=(dry:boolean)=>void action.run(async()=>{const current=version.current;const data=new FormData();data.set('file',file!);data.set('dry_run',String(dry));const result=await save<ImportReport>(`/admin/races/${raceId}/protocol-import`,'POST',data);if(current===version.current)setReport(result);});
  return <section className="card"><h2>Протокол из Excel</h2><p>В Excel сохраните нужный лист как CSV с разделителем «;». Сначала проверьте файл, затем загрузите. Протоколы появятся как черновики.</p>
    <Field label="CSV из Excel" type="file" accept=".csv,text/csv" disabled={action.busy} onChange={event=>{version.current++;setFile(event.target.files?.[0]);setReport(undefined);}}/>
    <div className="actions"><button disabled={!file||action.busy} onClick={()=>submit(true)}>Проверить</button><button className="primary" disabled={!report||report.saved||action.busy} onClick={()=>submit(false)}>Загрузить</button></div><Failure error={action.error}/>
    {report&&<div className="notice" role="status"><strong>{report.saved?'Протокол загружен':'Проверка завершена'}</strong><p>Строк: {report.rows}. Участников создано: {report.participants_created}. Протоколов создано: {report.protocols_created}.</p><p>Результаты: новых {report.results_created}, изменённых {report.results_updated}, без изменений {report.results_unchanged}. Изменений штрафов: {report.penalties_changed}.</p>{report.warnings.map((warning,i)=><p key={i}>{warning}</p>)}</div>}
  </section>;
}
export const protocolStatus=(protocol:Protocol)=>protocol.status==='final'?'final':protocol.published_at?'preliminary':'draft';
export function ChangeLog({path}:{path:string}) {
  const log=useResource<Record<string,unknown>[]>(path);
  return <details className="card"><summary>Журнал изменений</summary><LoadState resource={log}/>{log.data?.length===0&&<p>Изменений пока нет.</p>}{log.data?.map(row=><article key={String(row.id)}><p>{time(String(row.changed_at))} · {String(row.changed_by)} · {String(row.action)}</p><pre>{JSON.stringify(row,null,2)}</pre></article>)}</details>;
}
function ResultForm({protocol,row}:{protocol:ProtocolDetail;row?:Result}) {
  const final=protocol.status==='final';
  return <SaveForm label={final?'Исправить окончательный результат':'Сохранить результат'} onSave={data=>save(row?`/admin/stage-results/${row.id}${final?'/post-final-correction':''}`:`/admin/protocols/${protocol.id}/results`,row&&!final?'PATCH':'POST',{
    ...(!row?{race_participant_id:numeric(data,'race_participant_id')}:{}),status:string(data,'status'),time:optional(data,'time'),dogs_at_start:numeric(data,'dogs_at_start'),dogs_at_finish:numeric(data,'dogs_at_finish'),place:numeric(data,'place'),note:optional(data,'note'),reason:optional(data,'reason'),...(final?{approved_by:string(data,'approved_by')}:{}),
  })}>
    {!row&&<label className="field">Участник без результата<select name="race_participant_id" required><option value="">Выберите участника</option>{protocol.without_result.map(entry=><option key={entry.race_participant_id} value={entry.race_participant_id}>№{entry.start_number} · {entry.full_name}</option>)}</select></label>}
    <label className="field">Статус результата<select name="status" defaultValue={row?.status ?? 'finished'}><option value="finished">Финишировал</option><option value="dnf">DNF</option><option value="dns">DNS</option><option value="dsq">DSQ</option></select></label>
    <Field label="Время ЧЧ:ММ:СС" name="time" defaultValue={row?.time ?? ''} pattern="[0-9]+:[0-5][0-9]:[0-5][0-9]" placeholder="27:04:12"/><small>Длительность может быть больше 24 часов. Для DNF, DNS, DSQ оставьте время пустым.</small>
    <div className="grid"><Field label="Собаки на старте" name="dogs_at_start" type="number" min={1} defaultValue={row?.dogs_at_start ?? ''}/><Field label="Собаки на финише" name="dogs_at_finish" type="number" min={1} defaultValue={row?.dogs_at_finish ?? ''}/></div>
    <Field label="Место в дисциплине" name="place" type="number" min={1} defaultValue={row?.place ?? ''}/><Field label="Примечание" name="note" defaultValue={row?.note ?? ''}/><Field label="Основание исправления" name="reason" required={final} minLength={final?3:undefined}/>{final&&<Field label="Утвердивший исправление" name="approved_by" minLength={3} required/>}
  </SaveForm>;
}
function ProtocolEditor({id}:{id:number}) {
  const detail=useResource<ProtocolDetail>(`/admin/protocols/${id}`);const [rowId,setRowId]=useState<number>();const protocol=detail.data;const row=protocol?.results.find(r=>r.id===rowId);
  return <><LoadState resource={detail}/>{protocol&&<><section className="card"><h2>Этап {protocol.stage.number} · {protocol.discipline.name}</h2><div className="actions"><Status value={protocolStatus(protocol)}/><span>Опубликован: {time(protocol.published_at)}</span><span>Утверждён: {time(protocol.finalized_at)} · {protocol.finalized_by || '—'}</span></div>
    <div className="actions"><ConfirmButton disabled={Boolean(protocol.published_at)} question="Опубликовать протокол? Он станет доступен болельщикам, сервер отправит push." action={()=>save(`/admin/protocols/${id}/publish`,'POST')}>Опубликовать</ConfirmButton><ConfirmButton disabled={!protocol.published_at||protocol.status==='final'} question="Утвердить протокол как окончательный? Дальнейшие исправления требуют основания и утвердившего." action={()=>save(`/admin/protocols/${id}/finalize`,'POST')}>Утвердить</ConfirmButton></div>
    <details><summary>Шапка протокола</summary><SaveForm onSave={data=>save(`/admin/protocols/${id}`,'PATCH',{weather:optional(data,'weather'),chief_judge:optional(data,'chief_judge'),chief_secretary:optional(data,'chief_secretary')})}><Field label="Погода" name="weather" defaultValue={protocol.weather ?? ''}/><Field label="Главный судья" name="chief_judge" defaultValue={protocol.chief_judge ?? ''}/><Field label="Главный секретарь" name="chief_secretary" defaultValue={protocol.chief_secretary ?? ''}/></SaveForm></details>
    <Table label="Строки протокола"><thead><tr><th>Место</th><th>Участник</th><th>Регион</th><th>Статус</th><th>Время</th><th>Собаки старт/финиш</th><th>Правки</th></tr></thead><tbody>{protocol.results.map(result=><tr key={result.id}><td>{result.place ?? '—'}</td><th><button className="link-button" onClick={()=>setRowId(result.id)}>№{result.start_number} · {result.full_name}</button></th><td>{result.region || '—'}</td><td><Status value={result.status}/></td><td>{result.time || '—'}</td><td>{result.dogs_at_start ?? '—'} / {result.dogs_at_finish ?? '—'}</td><td>{result.is_corrected_after_final?'После утверждения':'—'}<small>{result.note}</small></td></tr>)}</tbody></Table>
    {protocol.status!=='final'&&<button onClick={()=>setRowId(undefined)}>Добавить результат</button>}
  </section>{(row||protocol.status!=='final')&&<section className="card"><h2>{row?row.full_name:'Новый результат'}</h2><ResultForm key={`${row?.id}:${protocol.status}`} protocol={protocol} row={row}/>{row&&protocol.status!=='final'&&<SaveForm label="Удалить строку" confirm="Удалить ошибочную строку протокола?" onSave={async data=>{await save(`/admin/stage-results/${row.id}?reason=${encodeURIComponent(string(data,'reason'))}`,'DELETE');setRowId(undefined);}}><Field label="Причина удаления строки" name="reason" minLength={3} required/></SaveForm>}</section>}
  <ChangeLog path={`/admin/protocols/${id}/changes`}/></>}</>;
}
function Penalties({raceId}:{raceId:number}) {
  const entries=useResource<Entry[]>(`/admin/races/${raceId}/participants`);const [entryId,setEntryId]=useState('');const penalties=useResource<Penalty[]>(entryId?`/admin/race-participants/${entryId}/penalties`:null);
  return <section className="card"><h2>Штрафы за гонку</h2><LoadState resource={entries}/><label className="field">Участник для штрафа<select value={entryId} onChange={e=>setEntryId(e.target.value)}><option value="">Выберите участника</option>{entries.data?.map(entry=><option key={entry.id} value={entry.id}>№{entry.start_number} · {entry.participant.full_name}</option>)}</select></label>
    {entryId&&<><LoadState resource={penalties}/>{penalties.data?.map(penalty=><details key={penalty.id}><summary>{penalty.time} · {penalty.rule_reference} · {penalty.reason}</summary><SaveForm label="Отменить штраф" confirm="Отменить этот штраф за гонку?" onSave={data=>save(`/admin/penalties/${penalty.id}?reason=${encodeURIComponent(string(data,'reason'))}`,'DELETE')}><Field label="Причина отмены штрафа" name="reason" minLength={3} required/></SaveForm></details>)}
      <SaveForm key={entryId} label="Добавить штраф" onSave={data=>save(`/admin/race-participants/${entryId}/penalties`,'POST',{time:string(data,'time'),rule_reference:optional(data,'rule_reference'),reason:optional(data,'reason'),change_reason:optional(data,'change_reason')})}><Field label="Штрафное время" name="time" required pattern="[0-9]+:[0-5][0-9]:[0-5][0-9]" placeholder="00:02:00"/><Field label="Пункт правил" name="rule_reference"/><Field label="Нарушение" name="reason"/><Field label="Основание для журнала" name="change_reason"/></SaveForm>
    </>}
  </section>;
}
export function Results({raceId}:{raceId:number}) {
  const protocols=useResource<Protocol[]>(`/admin/races/${raceId}/protocols`);const [id,setId]=useState<number>();const [tab,setTab]=useState('protocols');
  return <><div className="tabs">{[['protocols','Протоколы'],['import','Импорт CSV'],['penalties','Штрафы'],['log','Журнал гонки']].map(([value,label])=><button key={value} aria-pressed={tab===value} onClick={()=>setTab(value)}>{label}</button>)}</div>
    {tab==='import'&&<CsvImport raceId={raceId}/>} {tab==='penalties'&&<Penalties raceId={raceId}/>} {tab==='log'&&<ChangeLog path={`/admin/races/${raceId}/changes`}/>}
    {tab==='protocols'&&<><section className="card"><h2>Протоколы</h2><LoadState resource={protocols}/>{protocols.data?.length===0&&<p>Протоколов пока нет. Загрузите CSV судей.</p>}<div className="actions">{protocols.data?.map(protocol=><button key={protocol.id} onClick={()=>setId(protocol.id)}>Этап {protocol.stage.number} · {protocol.discipline.name} <Status value={protocolStatus(protocol)}/></button>)}</div></section>{id&&<ProtocolEditor key={id} id={id}/>}</>}
  </>;
}
